import {OrderedMap} from 'immutable';
import {IArticle, IAuthoringFieldV2, IFieldsV2, IContentProfileV2, IVocabulary} from 'superdesk-api';
import ng from 'core/services/ng';
import {httpRequestJsonLocal} from 'core/helpers/network';
import {dataApi} from 'core/helpers/CrudManager';
import {authoringApiCommon} from 'apps/authoring-bridge/authoring-api-common';
import {generatePatch} from 'core/patch';
import {appConfig} from 'appConfig';
import {getLabelNameResolver} from 'apps/workspace/helpers/getLabelForFieldId';
import {AutoSaveHttp} from './auto-save-http';
import {omit} from 'lodash';
import {AUTOSAVE_TIMEOUT} from 'core/constants';
import {sdApi} from 'api';
import {getFieldsAdapter} from './field-adapters';
import {IOldCustomFieldId} from './interfaces';
import {getArticleAdapter} from './article-adapter';

function getContentProfile(item: IArticle): Promise<IContentProfileV2> {
    interface IFakeScope {
        schema: any;
        editor: any;
        fields: any;
    }

    let fakeScope: Partial<IFakeScope> = {};

    return Promise.all([
        getLabelNameResolver(),
        ng.get('content').setupAuthoring(item.profile, fakeScope, item),
    ]).then((res) => {
        const [getLabelForFieldId] = res;
        const fieldsAdapter = getFieldsAdapter();

        const {editor, fields, schema} = fakeScope;

        const fieldsOrdered =
            Object.keys(editor)
                .map((key) => {
                    const result: {fieldId: string, editorItem: any} =
                        {
                            fieldId: key,
                            editorItem: editor[key],
                        };

                    return result;
                })
                .sort((a, b) => a.editorItem.order - b.editorItem.order);

        let headerFields: IFieldsV2 = OrderedMap<string, IAuthoringFieldV2>();
        let contentFields: IFieldsV2 = OrderedMap<string, IAuthoringFieldV2>();

        for (const {fieldId, editorItem} of fieldsOrdered) {
            const field = fields.find(({_id}) => _id === fieldId);

            const fieldV2: IAuthoringFieldV2 = (() => {
                if (fieldsAdapter.hasOwnProperty(fieldId)) { // main, hardcoded fields
                    return fieldsAdapter[fieldId].getFieldV2(editor[fieldId] ?? {}, schema[fieldId] ?? {});
                } else { // custom fields
                    const f: IAuthoringFieldV2 = {
                        id: fieldId,
                        name: getLabelForFieldId(fieldId),
                        fieldType: field.custom_field_type,
                        fieldConfig: field.custom_field_config,
                    };

                    return f;
                }
            })();

            if (editorItem.section === 'header') {
                headerFields = headerFields.set(fieldV2.id, fieldV2);
            } else if (editorItem.section === 'content') {
                contentFields = contentFields.set(fieldV2.id, fieldV2);
            } else {
                throw new Error('invalid section');
            }
        }

        const profile: IContentProfileV2 = {
            id: item.profile,
            name: 'test content profile',
            header: headerFields,
            content: contentFields,
        };

        return profile;
    });
}

export interface IAuthoringAutoSave {
    get(id: IArticle['_id']): Promise<IArticle>;
    delete(id: IArticle['_id'], etag: IArticle['_etag']): Promise<void>;
    cancel(): void;

    /**
     * A function that returns the article is used to improve performance.
     * In order to get the latest article, data has to be serialized. Using a function
     * allows to only do it once after timeout passes, instead of on every character change.
     */
    schedule(getItem: () => IArticle, callback: (autosaved: IArticle) => void): void;
}

/**
 * {@link AuthoringReact} component will use this interface
 * instead of making network calls directly.
 * Alternative implementation can be used
 * to enable offline support.
 */
interface IAuthoringStorage {
    lock(itemId: IArticle['_id']): Promise<IArticle>;
    unlock(itemId: IArticle['_id']): Promise<IArticle>;
    getArticle(id: string): Promise<{saved: IArticle | null, autosaved: IArticle | null}>;
    saveArticle(current: IArticle, original: IArticle): Promise<IArticle>;
    closeAuthoring(
        current: IArticle,
        original: IArticle,
        cancelAutosave: () => Promise<void>,
        doClose: () => void,
    ): Promise<void>;
    getContentProfile(item: IArticle): Promise<IContentProfileV2>;
    getUserPreferences(): Promise<any>;
    autosave: IAuthoringAutoSave;
    getVocabularies(): OrderedMap<string, IVocabulary>;
}

export function omitFields(
    item: Partial<IArticle>,
    omitId: boolean = false, // useful when patching
): Partial<IArticle> {
    /**
     * TODO: try getting rid of these when angular based monitoring is dropped.
     * When sending patches, these fields will automatically be excluded by patching algorithm
     * When receiving patches, server should be fixed if it sends invalid data.
     */

    const customFields = [
        '_latest_version',
        'revert_state',
        'expiry',
        '_current_version',
        'original_id',
        'ingest_version',
        'refs',
        'linked_in_packages',
    ];

    const baseApiFields = [
        '_created',
        '_links',
        '_updated',
        '_etag',
        '_status',
    ];

    if (omitId) {
        baseApiFields.push('_id');
    }

    return {...omit(item, [...customFields, ...baseApiFields])};
}

export const authoringStorage: IAuthoringStorage = {
    autosave: new AutoSaveHttp(AUTOSAVE_TIMEOUT),
    getArticle: (id) => {
        // TODO: take published items into account

        return dataApi.findOne<IArticle>('archive', id).then((_saved) => {
            const adapter = getArticleAdapter();

            const saved = adapter.toAuthoringReact(_saved);

            if (sdApi.article.isLockedInOtherSession(saved)) {
                return {saved, autosaved: null};
            } else if (sdApi.article.isLockedInCurrentSession(saved)) {
                return new Promise<IArticle>((resolve) => {
                    authoringStorage.autosave.get(id)
                        .then((_autosaved) => {
                            resolve(adapter.toAuthoringReact(_autosaved));
                        })
                        .catch(() => {
                            resolve(null);
                        });
                }).then((autosaved) => ({saved, autosaved}));
            } else {
                return {saved, autosaved: null};
            }
        });
    },
    lock: (id: IArticle['_id']) => {
        return sdApi.article.lock(id).then((article) => {
            const adapter = getArticleAdapter();

            return adapter.toAuthoringReact(article);
        });
    },
    unlock: (id: IArticle['_id']) => {
        return sdApi.article.unlock(id).then((article) => {
            const adapter = getArticleAdapter();

            return adapter.toAuthoringReact(article);
        });
    },
    saveArticle: (current, original) => {
        const adapter = getArticleAdapter();

        return authoringApiCommon.saveBefore(current, original).then((_current) => {
            const id = original._id;
            const etag = original._etag;

            let diff = generatePatch(original, _current);

            // when object has changes, send entire object to avoid server dropping keys
            if (diff.fields_meta != null) {
                diff.fields_meta = _current.fields_meta;
            }

            // when object has changes, send entire object to avoid server dropping keys
            if (diff.extra != null) {
                diff.extra = _current.extra;
            }

            diff = adapter.fromAuthoringReact(diff);

            const queryString = appConfig.features.publishFromPersonal === true
                ? '?publish_from_personal=true'
                : '';

            return httpRequestJsonLocal<IArticle>({
                method: 'PATCH',
                path: `/archive/${id}${queryString}`,
                payload: omitFields(diff),
                headers: {
                    'If-Match': etag,
                },
            }).then((next) => {
                authoringApiCommon.saveAfter(next, original);

                return adapter.toAuthoringReact(next);
            });
        });
    },
    getContentProfile,
    closeAuthoring: (current, original, cancelAutosave, doClose) => {
        const diff = generatePatch(original, current);
        const hasUnsavedChanges = Object.keys(diff).length > 0;

        const unlockArticle = (id: string) => httpRequestJsonLocal<void>({
            method: 'POST',
            payload: {},
            path: `/archive/${id}/unlock`,
        });

        return authoringApiCommon.closeAuthoring(
            original,
            hasUnsavedChanges,
            () => authoringStorage.saveArticle(current, original).then(() => undefined),
            () => unlockArticle(original._id),
            cancelAutosave,
            doClose,
        );
    },
    getUserPreferences: () => ng.get('preferencesService').get(),
    getVocabularies: () => OrderedMap<string, IVocabulary>(
        ng.get('vocabularies').getAllVocabulariesSync().map(
            (vocabulary) => [vocabulary._id, vocabulary],
        ),
    ),
};

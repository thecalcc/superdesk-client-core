import React from 'react';
import {IAuthoringSideWidget, IExtensionActivationResult, IUser} from 'superdesk-api';
import {gettext} from 'core/utils';
import {AuthoringWidgetHeading} from 'apps/dashboard/widget-heading';
import {AuthoringWidgetLayout} from 'apps/dashboard/widget-layout';
import {Button} from 'superdesk-ui-framework/react';
import {IEditor3Value} from '../manage-editor3-inside-authoring-react';
import {getCustomEditor3Data, getCustomMetadataFromContentState} from 'core/editor3/helpers/editor3CustomData';
import {getHighlightsConfig} from 'core/editor3/highlightsConfig';
import {store} from 'core/data';
import {Card} from 'core/ui/components/Card';
import {UserAvatar} from 'apps/users/components/UserAvatar';
import {TimeElem} from 'apps/search/components';
import {assertNever} from 'core/helpers/typescript-helpers';

// Can't call `gettext` in the top level
const getLabel = () => gettext('Inline comments');

type IProps = React.ComponentProps<
    IExtensionActivationResult['contributions']['authoringSideWidgets'][0]['component']
>;

type IInlineCommentsTab = 'resolved' | 'unresolved';

interface IState {
    selectedTab: IInlineCommentsTab;
}

interface IInlineComment {
    author: string;
    authorId: IUser['_id'];
    msg: string;
    commentedText: string;
    date: string;
    email: string;
    replies: Array<any>;
    resolutionInfo?: {
        resolverUserId: string;
        date: string;
    };
}

class InlineCommentsWidget extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            selectedTab: 'unresolved',
        };
    }

    render() {
        const {contentProfile, fieldsData} = this.props;
        const allFields = contentProfile.header.merge(contentProfile.content);
        const editor3Fields = allFields.filter((field) => field.fieldType === 'editor3');

        const commentsByField = (() => {
            if (this.state.selectedTab === 'unresolved') {
                return editor3Fields.map((field) => {
                    const value = fieldsData.get(field.id) as IEditor3Value;

                    return {
                        fieldId: field.id,
                        comments: getCustomMetadataFromContentState(
                            value.contentState,
                            getHighlightsConfig().COMMENT.type,
                        ).map((item) => item.obj.data as IInlineComment),
                    };
                }).toArray();
            } else if (this.state.selectedTab === 'resolved') {
                return editor3Fields.map((field) => {
                    const value = fieldsData.get(field.id) as IEditor3Value;

                    return {
                        fieldId: field.id,
                        comments: (getCustomEditor3Data(
                            value.contentState,
                            'RESOLVED_COMMENTS_HISTORY',
                        ) ?? []).map((item) => item.data as IInlineComment),
                    };
                }).toArray();
            } else {
                assertNever(this.state.selectedTab);
            }
        })().filter(({comments}) => comments.length > 0);

        return (
            <AuthoringWidgetLayout
                header={(
                    <AuthoringWidgetHeading
                        widgetName={getLabel()}
                        editMode={false}
                    />
                )}
                body={(
                    <div style={{display: 'flex', gap: 16, flexDirection: 'column'}}>
                        <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
                            <Button
                                text={gettext('Unresolved')}
                                onClick={() => {
                                    this.setState({selectedTab: 'unresolved'});
                                }}
                                type={this.state.selectedTab === 'unresolved' ? 'primary' : undefined}
                            />

                            <Button
                                text={gettext('Resolved')}
                                onClick={() => {
                                    this.setState({selectedTab: 'resolved'});
                                }}
                                type={this.state.selectedTab === 'resolved' ? 'primary' : undefined}
                            />
                        </div>

                        <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                            {
                                commentsByField.map(({fieldId, comments}, i) => {
                                    return (
                                        <div key={i} style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                                            <div>
                                                <div className="field-label--base">
                                                    {allFields.get(fieldId).name}
                                                </div>
                                            </div>

                                            {
                                                comments.map((comment, j) => {
                                                    const user = store.getState().users.entities[comment.authorId];

                                                    return (
                                                        <Card key={j}>
                                                            <div style={{display: 'flex', gap: 10}}>
                                                                <div>
                                                                    <UserAvatar user={user} />
                                                                </div>

                                                                <div>
                                                                    <strong>{user.display_name}</strong>:&nbsp;
                                                                    {comment.msg}

                                                                    <div>
                                                                        <TimeElem date={comment.date} />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {
                                                                comment.commentedText != null && (
                                                                    <div
                                                                        className="commented-text"
                                                                        style={{paddingTop: 10, marginBottom: 0}}
                                                                    >
                                                                        <div>{gettext('Selected text:')}</div>

                                                                        <strong
                                                                            title={comment.commentedText}
                                                                        >
                                                                            {comment.commentedText}
                                                                        </strong>
                                                                    </div>
                                                                )
                                                            }

                                                        </Card>
                                                    );
                                                })
                                            }
                                        </div>
                                    );
                                })
                            }
                        </div>
                    </div>
                )}
            />
        );
    }
}

export function getInlineCommentsWidget() {
    const metadataWidget: IAuthoringSideWidget = {
        _id: 'inline-comments-widget',
        label: getLabel(),
        order: 2,
        icon: 'comments',
        component: InlineCommentsWidget,
    };

    return metadataWidget;
}

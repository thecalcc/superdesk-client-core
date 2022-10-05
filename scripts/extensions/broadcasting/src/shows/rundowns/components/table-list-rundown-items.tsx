import {noop} from 'lodash';
import * as React from 'react';
import {TableList, Label, Dropdown, IconButton} from 'superdesk-ui-framework';
import {IMenuGroup, IMenuItem, ISubmenu} from 'superdesk-ui-framework/react/components/Dropdown';
import {IRundownItem, IRundownItemBase} from '../../../interfaces';
import {DurationLabel} from './duration-label';
import {Map} from 'immutable';
import {PlannedDurationLabel} from './planned-duration-label';
import {superdesk} from '../../../superdesk';
import {arrayMove} from '@superdesk/common';
import {IVocabularyItem} from 'superdesk-api';
import {SHOW_PART_VOCABULARY_ID, RUNDOWN_ITEM_TYPES_VOCABULARY_ID, RUNDOWN_SUBITEM_TYPES} from '../../../constants';
const {vocabulary} = superdesk.entities;
const {Spacer} = superdesk.components;
const {gettext} = superdesk.localization;

interface IProps<T> {
    items: Array<T>;
    onChange(items: Array<T>): void;
    onDelete(item: T): void;
    onDrag?(start: number, end: number): void;
    initiateCreation(initialData: Partial<IRundownItemBase>): void;
    initiateEditing(item: T): void;
    initiatePreview(item: T): void;
    readOnly: boolean;
    actions?: () => JSX.Element;
    dragAndDrop?: boolean;
    addItem?: boolean;
    itemsDropdown?: Array<IMenuItem | ISubmenu | IMenuGroup | 'divider'>;
    onDrag?(start: number, end: number): void;
}

export class TableListRundownItems<T extends IRundownItem> extends React.PureComponent<IProps<T>> {
    render() {
        const {readOnly} = this.props;

        const showParts = Map<string, IVocabularyItem>(
            vocabulary.getVocabulary(SHOW_PART_VOCABULARY_ID).items.map((item) => [item.qcode, item]),
        );

        const rundownItemTypes = Map<string, IVocabularyItem>(
            vocabulary.getVocabulary(RUNDOWN_ITEM_TYPES_VOCABULARY_ID).items.map((item) => [item.qcode, item]),
        );

        const subitemTypes = Map<string, IVocabularyItem>(
            vocabulary.getVocabulary(RUNDOWN_SUBITEM_TYPES).items.map((item) => [item.qcode, item]),
        );

        return (
            <TableList
                dragAndDrop
                addItem
                array={this.props.items.map((item) => {
                    const showPart = item.show_part == null ? null : showParts.get(item.show_part);
                    const itemType = item.item_type == null ? null : rundownItemTypes.get(item.item_type);
                    const subitems = item.subitems == null
                        ? null
                        : item.subitems
                            .map((qcode) => subitemTypes.get(qcode))
                            .filter((x) => x != null);

                    return ({
                        start: (
                            <Spacer h gap="4" justifyContent="start" noGrow>
                                {
                                    showPart != null && (
                                        <Label
                                            text={showPart.name}
                                            hexColor={showPart.color}
                                            size="normal"
                                        />
                                    )
                                }

                                {
                                    itemType != null && (
                                        <Label
                                            text={itemType.name}
                                            hexColor={itemType.color}
                                            size="normal"
                                        />
                                    )
                                }

                                {
                                // TODO: show 3 letter show symbol
                                }

                                {item.additional_notes}
                            </Spacer>
                        ),
                        center: (
                            <span>
                                {item.title}
                            </span>
                        ),
                        end: (
                            <Spacer h gap="4" justifyContent="start" noGrow>
                                {
                                    subitems != null && (
                                        <Spacer h gap="4" justifyContent="start" noGrow>
                                            {
                                                subitems.map(({name}, i) => (
                                                    <Label
                                                        key={i}
                                                        text={name}
                                                        style="translucent"
                                                        size="normal"
                                                    />
                                                ))
                                            }
                                        </Spacer>
                                    )
                                }

                                {
                                    item.planned_duration != null && (
                                        <PlannedDurationLabel
                                            planned_duration={item.planned_duration}
                                            size="default"
                                        />
                                    )
                                }

                                {
                                    item.duration != null && (
                                        <DurationLabel
                                            duration={item.duration}
                                            planned_duration={item.planned_duration}
                                            size="default"
                                        />
                                    )
                                }
                            </Spacer>
                        ),
                        action: (() => {
                            const actions: Array<IMenuItem> = [];

                            if (!readOnly) {
                                const edit: IMenuItem = {
                                    label: gettext('Edit'),
                                    onSelect: () => {
                                        this.props.initiateEditing(item);
                                    },
                                };

                                actions.push(edit);
                            }

                            const preview: IMenuItem = {
                                label: gettext('Preview'),
                                onSelect: () => {
                                    this.props.initiatePreview(item);
                                },
                            };

                            actions.push(preview);

                            const deleteAction: IMenuItem = {
                                label: gettext('Delete'),
                                onSelect: () => {
                                    this.props.onDelete(item);
                                },
                            };

                            actions.push(deleteAction);

                            return (
                                <Dropdown items={actions} append>
                                    <IconButton
                                        ariaValue={gettext('Actions')}
                                        icon="dots-vertical"
                                        onClick={noop}
                                    />
                                </Dropdown>
                            );
                        })(),
                    });
                })}
                itemsDropdown={(() => {
                    type IDropdownItems = React.ComponentProps<typeof TableList>['itemsDropdown'];

                    const result: IDropdownItems = rundownItemTypes.toArray()
                        .map((rundownType) => ({
                            label: rundownType.name,
                            onSelect: () => {
                                this.props.initiateCreation({
                                    item_type: rundownType.qcode,
                                });
                            },
                        }));

                    if (rundownItemTypes.size > 0) {
                        result.push('divider');
                    }

                    result.push({
                        label: gettext('(empty)'),
                        onSelect: () => {
                            this.props.initiateCreation({});
                        },
                    });

                    return result;
                })()}
                onDrag={(oldIndex, newIndex) => {
                    if (this.props.readOnly !== true) {
                        this.props.onChange(
                            arrayMove(this.props.items, oldIndex, newIndex),
                        );
                    }
                }}
            />
        );
    }
}

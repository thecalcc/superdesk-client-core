import * as React from 'react';

import {WithSizeObserver, ContentListItem, Label, IconButton, Menu, Alert} from 'superdesk-ui-framework/react';
import {IRundown, IRundownFilters, IRundownTemplate, IShow} from '../../interfaces';

import {superdesk} from '../../superdesk';
import {DurationLabel} from './components/duration-label';
import {PlannedDurationLabel} from './components/planned-duration-label';
import {addSeconds} from '@superdesk/common';

const {httpRequestRawLocal} = superdesk;
const {getVirtualListFromQuery, DateTime} = superdesk.components;
const {gettext} = superdesk.localization;

const VirtualListFromQuery = getVirtualListFromQuery<IRundown, {show: IShow; template: IRundownTemplate}>();

interface IProps {
    searchString: string;
    inEditMode: IRundown['_id'] | null;
    onEditModeChange(inEditMode: IRundown['_id'] | null): void;
    filters?: IRundownFilters;
}

export class RundownsList extends React.PureComponent<IProps> {
    render() {
        return (
            <WithSizeObserver style={{display: 'flex', margin: -4}}>
                {({width, height}) => (
                    <VirtualListFromQuery
                        width={width}
                        height={height}
                        query={{
                            endpoint: '/rundowns',
                            fullTextSearch: this.props.searchString.trim().length < 1
                                ? undefined
                                : this.props.searchString,
                            sort: [{_updated: 'desc'}],
                            filter: (() => {
                                const {filters} = this.props;

                                if (filters?.show == null) {
                                    return undefined;
                                } else {
                                    return {
                                        $and: [
                                            {show: {$eq: filters.show}},
                                        ],
                                    };
                                }
                            })(),
                            join: {
                                show: {
                                    endpoint: '/shows',
                                    getId: (rundown) => rundown.show,
                                },
                                template: {
                                    endpoint: (rundown) => `/shows/${rundown.show}/templates`,
                                    getId: (rundown) => rundown.template,
                                },
                            },
                        }}
                        itemTemplate={({entity: rundown, joined}) => (
                            <div style={{margin: 4}}>
                                <ContentListItem
                                    itemColum={[
                                        {
                                            itemRow: [
                                                {
                                                    content: (
                                                        <i className="icon-rundown" />
                                                    ),
                                                },
                                            ],
                                            border: true,
                                        },
                                        {
                                            itemRow: [
                                                {
                                                    content: (
                                                        <React.Fragment>
                                                            <span className="sd-list-item__slugline">
                                                                {rundown.airtime_time}
                                                                &nbsp;
                                                                -
                                                                &nbsp;
                                                                {
                                                                    addSeconds(
                                                                        rundown.airtime_time,
                                                                        (rundown.duration ?? rundown.planned_duration),
                                                                    )
                                                                }
                                                            </span>

                                                            {
                                                                rundown.duration != null && (
                                                                    <DurationLabel
                                                                        duration={rundown.duration}
                                                                        planned_duration={rundown.planned_duration}
                                                                        size="small"
                                                                    />
                                                                )
                                                            }

                                                            <PlannedDurationLabel
                                                                planned_duration={rundown.planned_duration}
                                                                size="small"
                                                            />

                                                            <DateTime dateTime={rundown._updated ?? rundown._created} />
                                                        </React.Fragment>
                                                    ),
                                                },
                                                {
                                                    content:
                                                    <React.Fragment>
                                                        {
                                                            joined.show != null && (
                                                                <Label text={joined.show.title} color="blue--800" />
                                                            )
                                                        }

                                                        {
                                                            joined.template != null && (
                                                                <span className="sd-list-item__compound-text">
                                                                    <span className="sd-list-item__text-label">
                                                                        {gettext('Template')}
                                                                    </span>
                                                                    <span>{joined.template.title}</span>
                                                                </span>
                                                            )
                                                        }

                                                        <span
                                                            className={[
                                                                'sd-overflow-ellipsis',
                                                                'sd-list-item--element-grow',
                                                                'sd-list-item__headline',
                                                            ].join(' ')}
                                                        >
                                                            {rundown.title}
                                                        </span>

                                                        <span>[status]</span>
                                                    </React.Fragment>,
                                                },
                                            ],
                                            fullwidth: true,
                                        },
                                    ]}
                                    locked={false}
                                    action={(
                                        <Menu // TODO: verify that ui-framework#667 is fixed
                                            items={[
                                                {
                                                    label: gettext('Edit'),
                                                    onClick: () => {
                                                        this.props.onEditModeChange(rundown._id);
                                                    },
                                                },
                                                {
                                                    label: gettext('Delete'),
                                                    onClick: () => {
                                                        httpRequestRawLocal({
                                                            method: 'DELETE',
                                                            path: `/rundowns/${rundown._id}`,
                                                            headers: {
                                                                'If-Match': rundown._etag,
                                                            },
                                                        });
                                                    },
                                                },
                                            ]}
                                        >
                                            {(toggle) => (
                                                <IconButton
                                                    icon="dots-vertical"
                                                    ariaValue={gettext('Actions')}
                                                    onClick={toggle}
                                                />
                                            )}
                                        </Menu>
                                    )}
                                    loading={false}
                                    activated={false}
                                    selected={false}
                                    archived={false}
                                    onClick={() => {
                                        this.props.onEditModeChange(rundown._id);
                                    }}
                                />
                            </div>
                        )}
                        noItemsTemplate={() => {
                            if (this.props.searchString == null) {
                                return (
                                    <Alert>{gettext('There are no rundowns yet')}</Alert>
                                );
                            } else {
                                return (
                                    <Alert>
                                        {
                                            gettext('No items found matching search criteria')
                                        }
                                    </Alert>
                                );
                            }
                        }}
                    />
                )}
            </WithSizeObserver>
        );
    }
}

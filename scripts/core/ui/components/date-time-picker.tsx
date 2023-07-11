import React from 'react';
import {DatePicker, TimePicker, Button} from 'superdesk-ui-framework';
import {appConfig} from 'appConfig';
import {gettext} from 'core/utils';
import {Spacer} from './Spacer';

interface IProps {
    value: Date;
    onChange(value: Date): void;
    required?: boolean;
}

function getTimeISO(date: Date | null): string {
    if (date == null) {
        return '';
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
}

export class DateTimePicker extends React.PureComponent<IProps> {
    render() {
        const {value} = this.props;

        return (
            <Spacer h gap="8" noWrap alignItems="center" justifyContent="space-evenly" >
                <DatePicker
                    inlineLabel
                    labelHidden
                    label={gettext('Date')}
                    value={value}
                    onChange={(val) => {
                        this.props.onChange(val);
                    }}
                    dateFormat={appConfig.view.dateformat}
                />
                <TimePicker
                    inlineLabel
                    labelHidden
                    label={gettext('Time')}
                    value={getTimeISO(value)}
                    onChange={(timeNext) => {
                        const [hoursStr, minutesStr] = timeNext.split(':');
                        const copiedDate = new Date(value?.getTime() ?? new Date());

                        copiedDate.setHours(parseInt(hoursStr, 10));
                        copiedDate.setMinutes(parseInt(minutesStr, 10));

                        this.props.onChange(copiedDate);
                    }}
                    required={this.props.required}
                />
                <Button
                    text={gettext('Clear')}
                    onClick={() => {
                        this.props.onChange(null);
                    }}
                    icon="close-small"
                    iconOnly
                    style="hollow"
                />
            </Spacer>
        );
    }
}

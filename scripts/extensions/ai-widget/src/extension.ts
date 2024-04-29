import {IExtension, IExtensionActivationResult} from 'superdesk-api';
import {AiAssistantWidget} from './ai-assistant';
import {superdesk} from './superdesk';

const extension: IExtension = {
    activate: () => {
        const result: IExtensionActivationResult = {
            contributions: {
                authoringSideWidgets: [{
                    _id: 'ai-assistant',
                    component: AiAssistantWidget,
                    icon: 'open-ai',
                    label: superdesk.localization.gettext('Ai Assistant'),
                    order: 2,
                }],
            },
        };

        return Promise.resolve(result);
    },
};

export {configure} from './configuration';

export default extension;

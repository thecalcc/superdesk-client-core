import React from 'react';
import {IArticle} from 'superdesk-api';
import {dataApi} from 'core/helpers/CrudManager';

interface IProps {
    ids: Array<IArticle['_id']>;
    onClick: (item: IArticle) => void;
}

interface IState {
    items: Array<IArticle>;
}

export class TranslationsList extends React.PureComponent<IProps, IState> {
    constructor(props) {
        super(props);
        this.state = {items: []};
    }

    componentDidMount() {
        Promise.all(this.props.ids.map((id) =>
            dataApi.findOne<IArticle>('archive', id),
        )).then((items) => {
            this.setState({items});
        });
    }

    render() {
        return (
            <ul className="simple-list" style={{padding: 0}}>
                {this.state.items.length === 0 && (
                    <li style={{minHeight: this.props.ids.length * 1.5 + 'em'}}>
                        <div className="sd-loader sd-loader--dark-ui" />
                    </li>
                )}
                {this.state.items.map((item) => {
                    return (
                        <li key={item._id} className="simple-list__item space-between" style={{gap: '10px'}}>
                            <b className="label label--hollow">{item.language}</b>
                            <a onClick={() => this.props.onClick(item)} style={{cursor: 'pointer'}}>
                                {item.headline || item.slugline}
                            </a>
                        </li>
                    );
                })}
            </ul>
        );
    }
}

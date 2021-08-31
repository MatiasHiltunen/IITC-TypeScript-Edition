import * as React from 'react'

class ChatControls extends React.Component {
    
    render() {
        return <div id="chatcontrols" /* style={{ display: 'none' }} */>
            <a accessKey="0" title="[0]"><span className="toggle" /></a>
            <a accessKey="1" title="[1]">all</a>
            <a accessKey="2" title="[2]" className="active">faction</a>
            <a accessKey="3" title="[3]">alerts</a>
        </div>

    }
}

class ChatHeaders extends React.Component {
    render() {
        return <div id="chat" style={{ display: 'none' }}>
            <div id="chatfaction" />
            <div id="chatall" />
            <div id="chatalerts" />
        </div>
    }
}

class ChatInput extends React.Component {
    render() {
        return <form id="chatinput" /* style={{ display: 'none' }} */>
            <table>
                <tbody><tr>
                    <td><time /></td>
                    <td><mark>tell faction:</mark></td>
                    <td><input id="chattext" type="text" maxLength={256} accessKey="c" title="[c]" /></td>
                </tr>
                </tbody>
            </table>
        </form>
    }
}


 class ChatComponent extends React.Component {

    render() {
        return (<div>
            <ChatControls></ChatControls>
            <ChatHeaders></ChatHeaders>
            <ChatInput></ChatInput>
        </div>
        );
    }
}

export default ChatComponent
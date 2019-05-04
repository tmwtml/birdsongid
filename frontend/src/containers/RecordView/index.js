import React, { Component }   from 'react';
import { connect }            from 'react-redux';
import { bindActionCreators } from 'redux';
import Button                 from 'components/Button';
import MicrophoneIcon         from 'material-ui/svg-icons/av/mic';
import DeleteIcon             from 'material-ui/svg-icons/action/delete';
import DoneIcon               from 'material-ui/svg-icons/action/done';
import ReactSimpleTimer       from 'react-simple-timer';
// import Microphone             from 'components/Microphone';
import { withRouter }         from 'react-router-dom';
import RecordRTC              from 'recordrtc';

import { styles } from './styles.scss';

/* actions */
import * as audioActionCreators from 'core/actions/actions-audio';

class RecordView extends Component {
  constructor(props) {
    super(props);
    this.state = {
      recording     : false,
      saveRecording : false,
      recordVideo: null
    }
  }

  // handle user media capture
  captureUserMedia(callback) {
    var params = { audio: true, video: false};

    navigator.getUserMedia(params, callback, (error) => {
      alert(JSON.stringify(error));
    });
  };

  startRecording= () => {
    this.setState({
      recording: true
    });

    this.captureUserMedia((stream) => {
      this.state.recordVideo = RecordRTC(stream, { type: 'audio', mimeType: "audio/wav", recorderType: RecordRTC.StereoAudioRecorder });
      this.state.recordVideo.startRecording();
    });
  }

  deleteRecording= () => {
    this.setState({
      recording: false
    });
  }

  saveRecording= () => {
    this.setState({
      recording     : false,
      saveRecording : true
    });

    this.state.recordVideo.stopRecording();
    
    // on stop for iphone (without react-mic)
    const { recordVideo } = this.state;
    const { actions, history } = this.props;

    setTimeout(function()
    {
      let recording = new Object()
      recording.blob = recordVideo.getBlob();
      console.log(recording)

      history.push('/recordings');
      actions.audio.saveRecording(recording);
    }, 3000);

  }

  // onStop= (recording) => {
  //   const { saveRecording, recordVideo } = this.state;
  //   const { actions, history } = this.props;

  //   console.log('---------------- on stop ----------------')
  //   console.log(saveRecording)

  //   if(saveRecording) {
  //     setTimeout(function()
  //     {
  //       recording.blob = recordVideo.blob;
  //       console.log(recording)

  //       history.push('/recordings');
  //       actions.audio.saveRecording(recording);
  //     }, 1000);
  //   }
  // }

  render() {
    let buttons;
    const { recording } = this.state;

    if(recording) {
      buttons= (
        <div className="buttons">
          <Button
            className="secondary delete"
            iconOnly={true}
            onTouchTap={this.deleteRecording}
            icon={<DeleteIcon />} />
          <Button
            secondary={true}
            raised={true}
            floating={true}
            disabled={true}
            icon={<MicrophoneIcon />} />
          <Button
            className="secondary save"
            iconOnly={true}
            onTouchTap={this.saveRecording}
            icon={<DoneIcon />} />
        </div>
      );
    } else {
      buttons = (
        <Button
          className="btn"
          secondary={true}
          raised={true}
          floating={true}
          onTouchTap={this.startRecording}
          icon={<MicrophoneIcon />} />
      );
    }

    return (
      <div className={styles}>
        {/* <Microphone record={recording} onStop={this.onStop} /> */}
        <div className="bird-icon"></div>
        <div id="controls">
          <ReactSimpleTimer play={recording} />
          {buttons}
        </div>
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  return {
    actions: {
      audio : bindActionCreators(audioActionCreators, dispatch)
    }
  };
}

export default withRouter(connect(null, mapDispatchToProps)(RecordView));
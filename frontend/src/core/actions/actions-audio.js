import types                      from 'core/types';
import { storeRecording,
         getAllStoredRecordings } from 'core/libs/lib-cache';
import uuid                       from 'uuid';
import axios from 'axios';
import moment    from 'moment';
import { strict } from 'assert';
// import { DH_CHECK_P_NOT_SAFE_PRIME } from 'constants';

const backip = '34.80.59.156'

/**
 * saveRecording - Save an audio file
 */
export function saveRecording(recording) {
  return (dispatch, getState) => {
    const { count } = getState().audio;
    const id  = uuid.v1();

    recording.title = `Recording #${count + 1}`;
    recording.id = id;
    recording.createdAt = moment().format('MMMM DD YYYY, h:mm a');
    recording.detail = 'Identifying the results...'
    recording.result = []

    console.log(typeof(recording))
    console.log(recording)
    console.log(recording.blob)

    let backurl = 'https://cors-anywhere.herokuapp.com/http://' + backip + ':5000/api/birdid'  


    // https://medium.com/@fakiolinho/handle-blobs-requests-with-axios-the-right-way-bb905bdb1c04
    const data = new FormData();
    data.append('file', recording.blob);

    axios.post(backurl, data, {
      headers: {
          'Content-Type': 'multipart/form-data'
      }
    })
    .then(response => {
      console.log(response)
      if (response.data.tmsay == 'Upload success!') {
        recording.detail = response.data.predicted[0][0].name_th + ' (' + response.data.predicted[0][1] + '%)'
        recording.result = response.data.predicted
      } else {
        recording.detail = response.data.tmsay
      }
    })
    .then(storeRecording(id, recording))
    .catch(error => {
      console.log(error)
      recording.detail = 'Server not found! Please contact the developer for assistance.'
    });
    

    dispatch((() => {
      return {
        type      : types.SAVE_RECORDING,
        recording : recording
      }
    })());
  }
}

/**
 * getAllRecordings - Get items from cache
 */
export function getAllRecordings() {
  return (dispatch) => {
    getAllStoredRecordings().then((list) => {
      const retrievedRecordings = list.sort((a,b) => {
        return b.startTime - a.startTime
      });

      dispatch((() => {
        return {
          type : types.GET_ALL_RECORDINGS,
          list : retrievedRecordings
        }
      })());
    });
  }
}
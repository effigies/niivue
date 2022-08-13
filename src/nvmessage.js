// Disabled warnings because of issue with JSDoc https://github.com/microsoft/TypeScript/issues/14377
// eslint-disable-next-line no-unused-vars
import { NVImageFromUrlOptions } from "./nvimage";
// eslint-disable-next-line no-unused-vars
import { NVMeshFromUrlOptions } from "./nvmesh";

export const UPDATE = "update";
export const CREATE = "create";
export const JOIN = "join";
export const ADD_VOLUME_URL = "add volume url";
export const REMOVE_VOLUME_URL = "remove volume media";
export const ADD_MESH_URL = "add mesh url";
export const REMOVE_MESH_URL = "remove mesh media";
export const SET_4D_VOL_INDEX = "set 4d vol index";
export const UPDATE_IMAGE_OPTIONS = "update image options";
export const UPDATE_CROSSHAIRS = "update crosshairs";
export const USER_CROSSHAIRS_UPDATED = "crosshairs updated";
export const USER_JOINED = "user joined";
export const UPDATE_SCENE_STATE = "update scene state";
export const UPDATE_USER_STATE = "update user state";
export const USER_STATE_UPDATED = "user state updated";
export const SCENE_STATE_UPDATED = "scene state update";



/**
 * @class NVSceneState
 * @type NVSceneState
 * @constructor
 * @param {number} azimuth
 * @param {number} elevation
 * @param {number[]} clipPlane
 * @param {number} zoom
 */
export function NVSceneState(azimuth, elevation, clipPlane, zoom) {
  return {
    azimuth,
    elevation,
    clipPlane,
    zoom,
  };
}

/**
 * @class NVUpdateUserStateMessage
 * @type NVUpdateUserStateMessage
 * @constructor
 * @param {string} id
 * @param {string} displayName
 * @param {number[]} color 
 */
export function NVUpdateUserStateMessage(id, userKey, displayName = "", color = [1, 0, 0]) {
  return {
    op: UPDATE_USER_STATE,
    id,
    userKey,
    displayName,
    color,    
  }
}

/**
 * @class NVUpdateCrosshairsPosMessage
 * @type NVUpdateCrosshairsPosMessage
 * @constructor
 * @param {string} id user id
 * @param {string} userKey user key
 * @param {number[]} crosshairsPos
 */
export function NVUpdateCrosshairsPosMessage(id,  userKey, crosshairsPos = [0.5, 0.5, 0.5]) {
  return {
    op: UPDATE_CROSSHAIRS,
    id,
    userKey,
    crosshairsPos,    
  }
}
/**
 * @class NVMessageSet4DVolumeIndex
 * @type NVMessageSet4DVolumeIndex
 * @constructor
 * @param {string} url
 * @param {number} index
 */
export function NVMessageSet4DVolumeIndexData(url, index) {
  return {
    url,
    index,
  };
}

/**
 * @class NVMessage
 * @type NVMessage
 * @description
 * NVMessage can be used to synchronize a session actions
 * @constructor
 * @param {string} messageType
 * @param {(string|NVMesssageUpdateData|NVImageFromUrlOptions|NVMeshFromUrlOptions|NVMessageSet4DVolumeIndex|number[])} messageData
 * @param {string} sessionKey
 */
export function NVMessage(messageType, messageData = "", sessionKey = "") {
  let message = {};
  message.key = sessionKey;
  message.op = messageType;

  switch (messageType) {
    case UPDATE:
    case UPDATE_SCENE_STATE:
      Object.assign(message, messageData);
      break;
    case UPDATE_IMAGE_OPTIONS:
    case ADD_VOLUME_URL:
      message.urlImageOptions = messageData;
      break;
    case ADD_MESH_URL:
      message.urlMeshOptions = messageData;
      break;
    case REMOVE_VOLUME_URL:
    case REMOVE_MESH_URL:
      message.url = messageData;
      break;
    case SET_4D_VOL_INDEX:
      message.url = messageData.url;
      message.index = messageData.index;
      break;
    case UPDATE_USER_STATE:
      throw "use UPDATE USER STATE MESSAGE constructor";
    case UPDATE_CROSSHAIRS:
      message.crosshairsPos = messageData.crosshairsPos;
      message.id = messageData.id;
      message.userKey = messageData.userKey;
      break;
  }

  return message;
}

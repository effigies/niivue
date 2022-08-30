import { v4 as uuidv4 } from "uuid";
import {  
  UPDATE,
  CREATE,
  JOIN,
  ADD_VOLUME_URL,
  REMOVE_VOLUME_URL,
  ADD_MESH_URL,
  REMOVE_MESH_URL,
  SET_4D_VOL_INDEX,
  UPDATE_IMAGE_OPTIONS,
  CROSSHAIR_POS_UPDATED,
  USER_JOINED,
  SCENE_STATE_UPDATED,
  USER_STATE_UPDATED,
  ACK,
} from "./nvmessage.js";

const MESSAGE_QUEUE_NAME = 'messages';
const MESSAGE_REF_COUNT_MAP_NAME = 'messageRefCountMap';
const SESSION_CLIENT_MAP_NAME = 'sessionClientMap';
const CLIENT_MESSAGE_QUEUE_NAME = 'clientMessageQueue';
const MAX_ALLOWED_LOCK_TIME = 3000;

/**
 * Checks if local storage is available
 * @param {string} type type of local storage requested
 * @returns {boolean}
 */
function storageAvailable(type) {
  let storage;
  try {
    storage = window[type];
    const x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return (
      e instanceof DOMException &&
      // everything except Firefox
      (e.code === 22 ||
        // Firefox
        e.code === 1014 ||
        // test name field too, because code might not be present
        // everything except Firefox
        e.name === "QuotaExceededError" ||
        // Firefox
        e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
      // acknowledge QuotaExceededError only if there's something already stored
      storage &&
      storage.length !== 0
    );
  }
}

/**
 * Get a random color to assign user
 * @returns {number[]} RGB color
 */
function getRandomColor() {
  let color;
  switch (Math.floor(Math.random() * 4)) {
    case 0:
      color = [1, 0, 0];
      break;
    case 1:
      color = [0, 1, 0];
      break;
    case 2:
      color = [0, 0, 1];
      break;
    default:
      color = [Math.random(), Math.random(), Math.random()];
  }

  return [...color, 1];
}

/**
 * @class NVLocalBus
 * @type NVLocalBus
 * @description NVLocalBus is for synchonizing local tabs and instance
 * @constructor
 * @param {function} onMessageCallback  call back for new messages
 */
export function NVLocalBus(onMessageCallback) {
  if (!storageAvailable("localStorage")) {
    throw "Local storage unavailable";
  }

  this.ackMessages = new Map();
  this.userMap = new Map();
  this.sceneMap = new Map();
  this.sessionOwnersMap = new Map();
  this.userCallbackMap = new Map();
  this.onMessageCallBack = onMessageCallback;
  this.clientId = uuidv4();
}

NVLocalBus.prototype.lockItem = function(itemName) {
  let mutexName = `${itemName}-mutex`;
  let mutex = localStorage.getItem(mutexName);
  let lockObtained = false;
  if(!mutex) {
    mutex = {
      locked: true,
      lockTime: Date.now()
    };
    lockObtained = true;
    localStorage.setItem(mutexName, mutex);
  }
  else {
    let now = new Date();
    const elapsed =  now - mutex.lockTime;
    // check if lock is not orphaned
    if(!mutex.locked || elapsed > MAX_ALLOWED_LOCK_TIME) {      
        mutex.lockTime = now;
        localStorage.setItem(mutexName, mutex);
        lockObtained = true;      
    }    
  }

  return lockObtained;
}

NVLocalBus.prototype.unlockItem = function(itemName) {
  let mutexName = `${itemName}-mutex`;
  let mutex = localStorage.getItem(mutexName);
  if(!mutex) {
    throw `${itemName} mutex does not exist`;
  }

  mutex.locked = false;
  localStorage.setItem(mutexName, mutex);
}

NVLocalBus.prototype.setItem = async function(itemName, value) {
 let lockObtained = this.lockItem(itemName);
 while(!lockObtained) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  lockObtained = this.lockItem(itemName);
 }
 localStorage.setItem(itemName, value);
 this.unlockItem(itemName);
}

NVLocalBus.prototype.lockAndGetItem = async function(itemName) {
  let lockObtained = this.lockItem(itemName);
 while(!lockObtained) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  lockObtained = this.lockItem(itemName);
 }
 return localStorage.getItem(itemName);
}

/**
 *
 * @param {*} message
 * @returns {string} user key of created user
 */
NVLocalBus.prototype.assignUser = function (message) {
  let displayName;
  let id = uuidv4();
  if (message.displayName) {
    displayName = message.displayName;
  } else {
    displayName = `user-${id}`;
  }
  let userKey = uuidv4();
  let color = message.color ? message.color : getRandomColor();
  let crosshairPos = [0.5, 0.5, 0.5];
  this.userMap.set(userKey, { id, displayName, color, crosshairPos });
  return userKey;
};

NVLocalBus.prototype.sendOtherClientsMessage = function (message) {
  let messages = localStorage.getItem(MESSAGE_QUEUE_NAME);
  let id = uuidv4();
  message.id = id;
  messages.push(message);
  localStorage.setItem(MESSAGE_QUEUE_NAME, messages);
  
  let clientSessionMap = localStorage.getItem(SESSION_CLIENT_MAP_NAME);
  for(const clientId in clientSessionMap) {
    if(clientId === this.clientId) {
      continue;
    }

  }
  let messageRefMap = localStorage.getItem(MESSAGE_REF_COUNT_MAP_NAME);
  if(!messageRefMap) {
    messageRefMap = new Map();
  }
  messageRefMap.set(id, this.sessionUserCount);
  localStorage.set(MESSAGE_REF_COUNT_MAP_NAME, messageRefMap);


};

NVLocalBus.prototype.sendMessage = function (message) {
  let scene = this.sceneMap.get(message["sessionName"]);
  let res = {
    message: "OK",
    op: ACK,
  };

  // create a unique id, update map of connected users
  switch (message.op) {
    case CREATE:
      res.op = CREATE;
      // check if we already have the session
      if (this.sessionMap.has(message.sessionName)) {
        res.message = "duplicate session";
        res.isError = true;
      } else {
        let scene = {
          elevation: 0,
          azimuth: 0,
          zoom: 1.0,
          cliplane: [0, 0, 0, 0],
          key: uuidv4(),
        };
        this.sessionMap.set(message.sessionName, scene);
        console.log("scene created for " + message.sessionName);
        let userKey = this.assignUser(message);
        let user = this.userMap.get(userKey);
        res["url"] = "";
        res["key"] = scene.key;
        res["userId"] = user.id;
        res["userKey"] = userKey;
        res["userName"] = user.displayName;

        // add this as a session owner
        this.sessionOwnersMap.set(message.sessionName, [user.id]);

        // console.log('created session ' + session);
        // console.log('url: ' + res['url']);
      }
      break;
    case UPDATE:
      // // console.log('update message called');
      // // only allow requests with session key to update
      // if (scene.key === message.key) {
      //   scene.azimuth = message.azimuth;
      //   scene.elevation = message.elevation;
      //   scene.zoom = message.zoom;
      //   scene.clipPlane = message.clipPlane;
        
        this.sendOtherClientsMessage({
          op: SCENE_STATE_UPDATED,
          message: "OK",
          azimuth: message.azimuth,
          elevation: message.elevation,
          zoom: message.zoom,
          clipPlane: message.clipPlane,
        });
      // }
      
      // create message for client

      break;
    case JOIN:
      if (scene) {
        res.op = JOIN;
        res["isController"] = message.key === scene.key;
        res["url"] = "";
        res["userList"] = Array.from(userMap.values());
        let userKey = assignUser(message);
        res["userKey"] = userKey;
        let user = userMap.get(userKey);
        res["userId"] = user.id;
        res["userName"] = user.displayName;

        // add user as controller
        if (res["isController"]) {
          sessionOwnersMap.get(session).push(user.id);
        }

        if (!connectionUserMap.has(websocketConnection)) {
          connectionUserMap.set(websocketConnection, user.id);
        } else {
          console.log(
            "connection already associated with " +
              connectionUserMap.get(websocketConnection)
          );
        }
        sendOtherClientsMessage(websocketConnection, {
          op: USER_JOINED,
          user: userMap.get(res["userKey"]),
        });
      } else {
        console.log("scene for " + session + " not found");
      }
      break;
    case UPDATE_IMAGE_OPTIONS:
    case ADD_VOLUME_URL:
      if (scene.key === message.key) {
        let msg = {
          op: message.op,
          urlImageOptions: message.urlImageOptions,
        };
        sendOtherClientsMessage(websocketConnection, msg);
      }
      break;
    case REMOVE_VOLUME_URL:
      if (scene.key === message.key) {
        sendOtherClientsMessage(websocketConnection, {
          op: REMOVE_VOLUME_URL,
          url: message.url,
        });
      }
      break;
    case SET_4D_VOL_INDEX:
      if (scene.key === message.key) {
        sendOtherClientsMessage(websocketConnection, {
          op: SET_4D_VOL_INDEX,
          url: message.url,
          index: message.index,
        });
      }
      break;
    case ADD_MESH_URL:
      if (scene.key === message.key) {
        let msg = {
          op: message.op,
          urlMeshOptions: message.urlMeshOptions,
        };
        sendOtherClientsMessage(websocketConnection, msg);
      }
      break;
    case REMOVE_MESH_URL:
      if (scene.key === message.key) {
        sendOtherClientsMessage(websocketConnection, {
          op: REMOVE_MESH_URL,
          url: message.url,
        });
      }
      break;
    case UPDATE_USER_STATE:
      if (userMap.has(message.userKey)) {
        let user = userMap.get(message.userKey);
        if (message.id == user.id) {
          user.color = message.color;
          user.displayName = message.displayName;

          userMap.set(message.userKey, user);
        }
      }
      break;

    case UPDATE_CROSSHAIR_POS:
      if (userMap.has(message.userKey)) {
        let user = userMap.get(message.userKey);
        if (message.id == user.id) {
          console.log("updating crosshairs for " + user.displayName);
          console.log(message.crosshairPos);

          user.crosshairPos = message.crosshairPos;
          userMap.set(message.userKey, user);
          let msg = {
            op: CROSSHAIR_POS_UPDATED,
            id: user.id,
            isController: sessionOwnersMap.get(session).includes(user.id),
            crosshairPos: message.crosshairPos,
          };

          sendOtherClientsMessage(websocketConnection, msg);
        }
      }
      break;

    default:
      res["op"] = SCENE_STATE_UPDATED;
      res["azimuth"] = scene.azimuth;
      res["elevation"] = scene.elevation;
      res["zoom"] = scene.zoom;
      res["clipPlane"] = scene.clipPlane;

      break;
  }
  return res;
};

NVLocalBus.prototype.localStorageEventListener = function (e) {
  // are we the sender?
  if (e.key === MESSAGE_QUEUE_NAME) {
    let messages = localStorage.getItem(e.key);
    // for(let i = 0; i < messages.length; i++) {
    //   this.
    // }

  }

  // call our callback

  // lock up after you're done
  // remove the message if all users acknowledged the message
};

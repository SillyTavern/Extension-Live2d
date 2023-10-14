/*
TODO:
- Security
  - wait before sending interaction message if one is running
  - Resize model on resize window
- Features
  - Background transparent OK
  - Load character model from character folder OK
  - Update character model when chat change OK
  - Resize model option
  - Automatically load hit frames and animation list
  - UI for user to connect hit frames with animation
  - Plug to expression
  - Play mouth animation when talking (message length dependant)
  - model setting per character
  - Group chat mode
*/

import { loadFileToDocument } from "../../../utils.js";
import { saveSettingsDebounced, getRequestHeaders, eventSource, event_types } from "../../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../../extensions.js";
import { getMessageTimeStamp } from "../../../RossAscends-mods.js";
export { MODULE_NAME };

const extensionFolderPath = `scripts/extensions/third-party/Extension-Live2d`;

const MODULE_NAME = 'Live2d';
const DEBUG_PREFIX = "<Live2d extension> ";
const UPDATE_INTERVAL = 1000;
const CHARACTER_LIVE2D_FOLDER = "live2d";

const JS_LIBS = [
  "live2dcubismcore.min.js",
  "live2d.min.js",
  "pixi.min.js",
  "index.min.js",
  "extra.min.js"
]

// Load JS libraries
for(const i of JS_LIBS){
  await loadFileToDocument(
      `${extensionFolderPath}/lib/${i}`,
      "js"
  );
}

const live2d = PIXI.live2d;

let characters_model_path = {}
let models = [];
let app = null;

//#############################//s
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    showHitFrames: false,
    followCursor: false,
}

function loadSettings() {
    if (extension_settings.live2d === undefined)
        extension_settings.live2d = {};

    // Ensure good format
    if (Object.keys(extension_settings.live2d).length === 0) {
        Object.assign(extension_settings.live2d, defaultSettings)
    }

    $("#live2d_enabled").prop('checked', extension_settings.live2d.enabled);
    $("#live2d_follow_cursor").prop('checked', extension_settings.live2d.followCursor);
    $("#live2d_show_hit_frames").prop('checked', extension_settings.live2d.showHitFrames);
}

async function onEnabledClick() {
    extension_settings.live2d.enabled = $('#live2d_enabled').is(':checked');
    saveSettingsDebounced();
}

async function onFollowCursorClick() {
  extension_settings.live2d.followCursor = $('#live2d_follow_cursor').is(':checked');
  saveSettingsDebounced();

  models.forEach((model) => {
    model._autoInteract = extension_settings.live2d.followCursor;
  });
  loadLive2d();
}

async function onShowHitFramesClick() {
  extension_settings.live2d.showHitFrames = $('#live2d_show_hit_frames').is(':checked');
  saveSettingsDebounced();

  models.forEach((model) => {
    model.children[0].visible = extension_settings.live2d.showHitFrames;
  });
}


//#############################//
//  Methods                    //
//#############################//

function draggable(model) {
  model.buttonMode = true;
  model.on("pointerdown", (e) => {
    model.dragging = true;
    model._pointerX = e.data.global.x - model.x;
    model._pointerY = e.data.global.y - model.y;
  });
  model.on("pointermove", (e) => {
    if (model.dragging) {
      model.position.x = e.data.global.x - model._pointerX;
      model.position.y = e.data.global.y - model._pointerY;
    }
  });
  model.on("pointerupoutside", () => (model.dragging = false));
  model.on("pointerup", () => (model.dragging = false));
}

function addHitAreaFrames(model) {
  const hitAreaFrames = new live2d.HitAreaFrames();

  model.addChild(hitAreaFrames);
  hitAreaFrames.visible = extension_settings.live2d.showHitFrames;
}

async function sendMessage(text) {
  $('#send_textarea').val("") // clear message area to avoid double message
  console.debug(DEBUG_PREFIX,"Sending message head pat")
  const context = getContext();
  const messageText = text;
  const message = {
      name: context.name1,
      is_user: true,
      send_date: getMessageTimeStamp(),
      mes: messageText,
  };
  context.chat.push(message);
  context.addOneMessage(message);

  context.generate();
}

async function loadLive2d() {
  if(app !== null)
    app.destroy();

  document.getElementById("live2d-canvas").hidden = true;

  const character = getContext().name2;

  if (characters_model_path[character] == undefined)
    return;

  document.getElementById("live2d-canvas").hidden = false;

  const model = await live2d.Live2DModel.from(characters_model_path[character]);// TODO: multiple models

  app = new PIXI.Application({
    view: document.getElementById("live2d-canvas"),
    autoStart: true,
    resizeTo: window,
    backgroundAlpha: 0
  });

  app.stage.addChild(model);

  const scaleX = (innerWidth * 0.4) / model.width;
  const scaleY = (innerHeight * 0.8) / model.height;

  // fit the window
  model.scale.set(Math.min(scaleX, scaleY));

  model.x = (innerWidth - model.width) / 2;
  model.y = innerHeight * 0.1;

  draggable(model);
  //addFrame(model);
  addHitAreaFrames(model);

  // handle tapping
  model.on("hit", (hitAreas) => {
    if (hitAreas.includes("body")) {
      model.motion("tap_body");

      sendMessage("*Click on her body to make her talk about her uniform.*");
    }

    if (hitAreas.includes("mouth")) {
      //model.expression();
      model.motion("pinch_out");
      sendMessage("*Click on her mouth for testing animation and sound.*");
    }
    else {
      if (hitAreas.includes("head")) {
        model.motion("pinch_in");
        model.expression();

        sendMessage("*Click on her head to test other animation and gives her a headpat.*");
      }
    }
  });

  // Set cursor behavior
  model._autoInteract = extension_settings.live2d.followCursor;
  console.debug(DEBUG_PREFIX,model);

  
}

async function updateCharactersModels() {
  const character = getContext().name2; // TODO group chat
  if (characters_model_path[character] === undefined){
    const files = await getCharacterLive2dFiles(character);

    for(const i of files){
      console.debug(DEBUG_PREFIX,"file found:",i);
      if (i.includes("model")) {
        console.debug(DEBUG_PREFIX,"Model settings file found:",i);
        characters_model_path[character] = i;
        break;
      }
    }

    console.debug(DEBUG_PREFIX,"Updated models path to:",characters_model_path)
  }
  await loadLive2d();
}

//#############################//
//  API Calls                  //
//#############################//

async function getCharacterLive2dFiles(name) {
  console.debug(DEBUG_PREFIX, "getting live2d model json file for", name);

  try {
      const result = await fetch(`/api/assets/character?name=${encodeURIComponent(name)}&category=${CHARACTER_LIVE2D_FOLDER}`, {
          method: 'POST',
          headers: getRequestHeaders(),
      });
      let files = result.ok ? (await result.json()) : [];
      return files;
  }
  catch (err) {
      console.log(err);
      return [];
  }
}

//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    const moduleEnabled = extension_settings.live2d.enabled;

    if (moduleEnabled) {

    }
}

//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    $('#extensions_settings').append(windowHtml);
    loadSettings();

    // Set user interactions
    $("#live2d_enabled").on("click", onEnabledClick);
    $("#live2d_follow_cursor").on("click", onFollowCursorClick);
    $("#live2d_show_hit_frames").on("click", onShowHitFramesClick);
    
    // Module worker
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    // Events
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersModels);

    // DBG Tests

    var canvas = document.createElement('canvas');
    canvas.id = "live2d-canvas";
    document.getElementById("expression-wrapper").appendChild(canvas);

    //await loadLive2d();
    console.debug(DEBUG_PREFIX,"Finish loaded.");
});

/*
DONE:
- Features
  - Background transparent
  - Load character model from character folder
  - Update character model when chat change
  - Resize model option
  - model setting per character
  - UI to plug classify expression to live2d expression/motion
  - Update animations when new message received base on classify and ui mapping
  - Allow multiple models for one character / ability to switch / force animation
  - option to test expression/animation (use override menu)
  - add a default expression and fallback to it when mapping for classified expression is none
  - remove case sensitivy to expression name, some model have "name" and "Name" keys
  - UI for user to connect hit area with animations and message
  - Refactored code into seperate files
  - Group chat mode
  - button clear all models settings for a character
  - Coordinate sliders
  - Play mouth animation when talking (message length dependant)
  - load models from assets folder
  - starting animation option
  - factorized the expression/motion selects

TODO:
- Security
  - wait before sending interaction message if one is running
  - Resize model on resize window
- Features
  - replay button for animation selection and factorise playtest
  - reset live2d canvas button
  - Default model click mapping
  - option to hide sprite per character
  - don't send hit area when moving
  - Cleanup useless imports and comments

IDEAS:
  - Synchronize mouth with TTS audio (maybe can make it play through live2d with lip sync)
  - option to detach live2d ui
  - Look at speaker option
  - Flip Y option
  - change order of model
  - hide models before starter animation play? (canvas hidden / model.visible = false make glitch)
*/
import { eventSource, event_types } from "../../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper, modules } from "../../../extensions.js";
export { MODULE_NAME };

import {
  MODULE_NAME,
  DEBUG_PREFIX,
  extensionFolderPath,
} from "./constants.js";

import {
  onEnabledClick,
  onFollowCursorClick,
  onAutoSendInteractionClick,
  onShowFramesClick,
  onCharacterChange,
  onCharacterRefreshClick,
  onCharacterRemoveClick,
  onShowAllCharactersClick,
  onModelRefreshClick,
  onModelChange,
  onModelScaleChange,
  onModelCoordChange,
  onParamMouthOpenIdChange,
  onMouthOpenSpeedChange,
  onMouthTimePerCharacterChange,
  onAnimationMappingChange,
  updateCharactersModels,
  updateCharactersList,
  updateCharactersListOnce,
  playStarterAnimation
} from "./ui.js";

import {
  updateExpression,
  playMessage,
  playExpression
} from "./live2d.js";

const UPDATE_INTERVAL = 1000;


//#############################//s
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    // Global settings
    enabled: false,
    followCursor: false,
    autoSendInteraction: false,

    // Debug
    showFrames: false,

    // Character model mapping
    characterModelMapping: {},
    characterModelsSettings: {},
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
    $("#live2d_auto_send_interaction").prop('checked', extension_settings.live2d.autoSendInteraction);
    
    $("#live2d_show_frames").prop('checked', extension_settings.live2d.showFrames);
}

//#############################//
//  Methods                    //
//#############################//



//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    const moduleEnabled = extension_settings.live2d.enabled;

    if (moduleEnabled) {
      // DBG

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
    $('#live2d_auto_send_interaction').on("click", onAutoSendInteractionClick);
    $("#live2d_show_frames").on("click", onShowFramesClick);

    $("#live2d_character_select").on("change", onCharacterChange);
    $("#live2d_character_refresh_button").on("click", onCharacterRefreshClick);
    $("#live2d_character_remove").on("click", onCharacterRemoveClick);
    $("#live2d_show_all_characters").on("click", onShowAllCharactersClick);
    
    $("#live2d_model_refresh_button").on("click", onModelRefreshClick);
    $("#live2d_model_select").on("change", onModelChange);

    $("#live2d_model_scale").on("input", onModelScaleChange);
    $("#live2d_model_x").on("input", onModelCoordChange);
    $("#live2d_model_y").on("input", onModelCoordChange);

    $("#live2d_param_mouth_open_y_id_select").on("change", onParamMouthOpenIdChange);
    $("#live2d_mouth_open_speed").on("input", onMouthOpenSpeedChange);
    $("#live2d_mouth_time_per_character").on("input", onMouthTimePerCharacterChange);

    $("#live2d_expression_select_override").on("change", () => {onAnimationMappingChange("animation_override")});
    $("#live2d_motion_select_override").on("change", () => {onAnimationMappingChange("animation_override")});
    $("#live2d_animation_override_expression_replay").on("click", () => {onAnimationMappingChange("animation_override")});
    $("#live2d_animation_override_motion_replay").on("click", () => {onAnimationMappingChange("animation_override")});

    $("#live2d_animation_starter_expression_select").on("change", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_animation_starter_motion_select").on("change", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_animation_starter_expression_replay").on("click", () => {onAnimationMappingChange("animation_starter")});
    $("#live2d_animation_starter_motion_replay").on("click", () => {onAnimationMappingChange("animation_starter")});
    
    $("#live2d_expression_select_default").on("change", () => {onAnimationMappingChange("animation_default")});
    $("#live2d_motion_select_default").on("change", () => {onAnimationMappingChange("animation_default")});
    $("#live2d_animation_default_expression_replay").on("click", () => {onAnimationMappingChange("animation_default")});
    $("#live2d_animation_default_motion_replay").on("click", () => {onAnimationMappingChange("animation_default")});

    // Module worker
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    // Events
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersList);
    eventSource.on(event_types.CHAT_CHANGED, updateCharactersModels);
    eventSource.on(event_types.CHAT_CHANGED, playStarterAnimation);

    eventSource.on(event_types.GROUP_UPDATED, updateCharactersList);
    eventSource.on(event_types.GROUP_UPDATED, updateCharactersModels);

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => updateExpression(chat_id));
    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => playMessage(chat_id));
    updateCharactersListOnce();

    //await loadLive2d();
    console.debug(DEBUG_PREFIX,"Finish loaded.");
});
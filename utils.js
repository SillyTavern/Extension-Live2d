import { getContext } from "../../../extensions.js";

export {
    currentChatMembers,
    loadAnimationUi
}

function currentChatMembers() {
    const context = getContext();
    const group_id = context.groupId;
    let chat_members = [context.name2];

    if (group_id !== null) {
        chat_members = [];
        for(const i of context.groups) {
            if (i.id == context.groupId) {
                for(const j of i.members) {
                    let char_name = j.replace(/\.[^/.]+$/, "")
                    if (char_name.includes("default_"))
                        char_name = char_name.substring("default_".length);
                    
                    chat_members.push(char_name);
                }
            }
        }
    }

    chat_members.sort();

    return chat_members;
}
 
function loadAnimationUi(model_expressions, model_motions, expression_select_id, motion_select_id, expression_select_value, motion_select_value) {
    $(`#${expression_select_id}`)
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select expression</option>');

  $(`#${motion_select_id}`)
    .find('option')
    .remove()
    .end()
    .append('<option value="none">Select motion</option>');

    for (const i of model_expressions) {
        const name = i[Object.keys(i).find(key => key.toLowerCase() === "name")];
        const file = i[Object.keys(i).find(key => key.toLowerCase() === "file")];
        $(`#${expression_select_id}`).append(new Option(name+" ("+file+")", name));
    }

    for (const motion in model_motions) {
        if (model_motions[motion].length == 1) {
            $(`#${motion_select_id}`).append(new Option(motion, motion + "_id=random"));
        }
        else {
            $(`#${motion_select_id}`).append(new Option(motion + " random", motion + "_id=random"));
            for (const motion_id in model_motions[motion]) {
                const file = model_motions[motion][motion_id][Object.keys(model_motions[motion][motion_id]).find(key => key.toLowerCase() === "file")];
                $(`#${motion_select_id}`).append(new Option(motion + " " + motion_id + " ("+file+")", motion + "_id=" + motion_id));
            }
            }
        }

    $(`#${expression_select_id}`).val(expression_select_value);
    $(`#${motion_select_id}`).val(motion_select_value);
}
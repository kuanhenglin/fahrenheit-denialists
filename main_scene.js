import {defs, tiny} from './classes/common.js';
// import {Axes_Viewer, Axes_Viewer_Test_Scene} from "./examples/axes_viewer.js"
// import {Collision_Demo, Inertia_Demo} from "./examples/collisions_demo.js"
// import {Many_Lights_Demo} from "./examples/many_lights_demo.js"
// import {Obj_File_Demo} from "./examples/obj_file_demo.js"
// import {Scene_To_Texture_Demo} from "./examples/scene_to_texture_demo.js"
// import {Surfaces_Demo} from "./examples/surfaces_demo.js"
// import {Text_Demo} from "./examples/text_demo.js"
// import {Transforms_Sandbox} from "./examples/transforms_sandbox.js"
import {Sandbox_Main} from "./scenes/sandbox_main.js";
import {Sandbox_Shader} from "./scenes/sandbox_shader.js";
import {Sandbox_Physics} from "./scenes/sandbox_physics.js";

// Pull these names into this module's scope for convenience:
const {
  Vector, Vector3, vec, vec3, vec4, color, Matrix, Mat4, Light, Shape, Material, Shader, Texture, Scene,
  Canvas_Widget, Code_Widget, Text_Widget
} = tiny;

// Now we have loaded everything in the files tiny_graphics.js, tiny_graphics_widgets.js, and common.js.
// This yielded "tiny", an object wrapping the stuff in the first two files, and "defs" for wrapping all the rest.

// ******************** Extra step only for when executing on a local machine:
//                      Load any more files in your directory and copy them into "defs."
//                      (On the web, a server should instead just pack all these as well
//                      as common.js into one file for you, such as "dependencies.js")

// const Minimal_Webgl_Demo = defs.Minimal_Webgl_Demo;

Object.assign(defs,
  {Sandbox_Main},
  {Sandbox_Shader},
  {Sandbox_Physics},
);

// ******************** End extra step

// (Can define Main_Scene's class here)

const Main_Scene = Sandbox_Main;
// const Additional_Scenes = [];

export {Main_Scene, Canvas_Widget, Code_Widget, Text_Widget, defs}  // removed: Additional_Scenes
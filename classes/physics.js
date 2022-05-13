import {defs, tiny} from "./common.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


const GRAVITY = vec3(0.0, -9.81, 0.0);
const DAMPEN = 0.70;
const ERROR = 0.0001;


export class Object {
  constructor({ shape, material,
                position, velocity, acceleration,
                scale, rotation,
                color }={}) {
    this.shape = shape;
    this.material = material;
    this.transform = Mat4.identity();

    this.position = position? position : vec3(0.0, 0.0, 0.0);
    this.velocity = velocity? velocity : vec3(0.0, 0.0, 0.0);
    this.acceleration = acceleration? acceleration : GRAVITY;

    this.scale = scale? scale : vec3(1.0, 1.0, 1.0);
    this.rotation = rotation? rotation : vec4(0.0, 0.0, 0.0, 0.0);

    this.bounding = {
      position: [vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.0)],
      box: new Bounding_Box(hex_color("#ffff55")),
      shader: new Material(new defs.Basic_Shader()),
    };

    this.color = color? color : hex_color("#aaaaaa");
  }

  draw_object({ context, program_state, update=true,
                delta_time, pre_transform, post_transform,
                draw_bounding=true }={}) {
    if (update && delta_time < 0.05) {
      this.update({
        delta_time: delta_time, pre_transform: pre_transform, post_transform: post_transform,
      });
    }
    this.shape.draw(context, program_state, this.transform, this.material.override({color: this.color}));
    if (draw_bounding) {
      this.draw_bounding(context, program_state);
    }
  }

  // ***** POSITION UPDATE *****

  update({ delta_time,
           pre_transform=null, post_transform=null,
           bounding=true }) {
    this.update_velocity(delta_time);
    this.update_position(delta_time);
    this.update_transform(pre_transform, post_transform);
    if (bounding) {
      this.update_bounding();
    }
  }

  update_position(delta_time) {
    this.position = this.position.plus(this.velocity.times(delta_time));
    if (this.position[1] < -5.0) {  // temporary bounce
      this.velocity[1] = -0.9 * this.velocity[1];
    }
  }

  update_velocity(delta_time) {
    this.velocity = this.velocity.plus(this.acceleration.times(delta_time));
  }

  update_transform(pre_transform=null, post_transform=null) {
    this.transform = Mat4.identity()
      .times(post_transform? post_transform : Mat4.identity())
      .times(Mat4.translation(...this.position))
      .times(pre_transform? pre_transform : Mat4.identity())
      .times(Mat4.rotation(...this.rotation))
      .times(Mat4.scale(...this.scale));
  }

  // ***** COLLISION *****

  update_bounding() {
    // convert vertices from object to world space
    let vertices = this.shape.arrays.position.map(vertex => this.transform.times(vertex.to4(1.0)).to3());
    let length = vertices.length;
    let vertices_x = new Array(length), vertices_y = new Array(length), vertices_z = new Array(length);
    for (let i = 0; i < length; ++i) {  // slightly faster than using .map()
      [vertices_x[i], vertices_y[i], vertices_z[i]] = [vertices[i][0], vertices[i][1], vertices[i][2]];
    }

    this.bounding.position = [
      vec3(Math.min(...vertices_x), Math.min(...vertices_y), Math.min(...vertices_z)),  // minimum x, y, z
      vec3(Math.max(...vertices_x), Math.max(...vertices_y), Math.max(...vertices_z)),  // maximum x, y, z
    ];
  }

  draw_bounding(context, program_state) {
    let scale = this.bounding.position[1].minus(this.bounding.position[0]).times(0.5);
    let position = this.bounding.position[1].plus(this.bounding.position[0]).times(0.5);
    let bounding_transform = Mat4.identity()
      .times(Mat4.translation(...position))
      .times(Mat4.scale(...scale));
    this.bounding.box.draw(context, program_state, bounding_transform, this.bounding.shader, "LINES");
  }
}


class Bounding_Box extends Shape {
  constructor(color_box=hex_color("#ffffff")) {
    super("position", "color");
    let vertices = [
      [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1], [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
    ]
    let indices = [0, 1, 0, 2, 1, 3, 2, 3, 4, 5, 4, 6, 5, 7, 6, 7, 0, 4, 1, 5, 2, 6, 3, 7];
    this.arrays.position = indices.map(index => vec3(...vertices[index]));
    this.arrays.color = Array(24).fill(color_box);
    this.indices = false;
  }
}
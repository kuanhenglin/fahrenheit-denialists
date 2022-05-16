import {defs, tiny} from "./common.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


const GRAVITY = vec3(0.0, -9.81, 0.0);
const DAMPEN = 0.70;
const ERROR = 0.0001;
const ERROR_SMALL = 0.0000001;
const HUGE = 999999999.9;


// collision function which is called by the main scene, takes in array of objects
export function collision(objects) {
  // generate all 2-combinations of objects (pair-wise collision check)
  // this is not efficient at all, but it will (have to) do now
  let indices = [...Array(objects.length).keys()];
  let object_pairs = indices.flatMap(
    (v, i) => indices.slice(i+1).map(w => [v, w])
  );
  // the current way that collision is shown is via console.log
  let collisions = [];
  for (let i = 0; i < object_pairs.length; ++i) {
    let is_collision_pair = is_colliding(objects[object_pairs[i][0]], objects[object_pairs[i][1]]);
    collisions.push(`${object_pairs[i]}: ${is_collision_pair}`);
  }
  console.log(collisions.join("\t"));
}


// uses separating axis theorem (SAT) projection
function separating_axis_projection(normal, vertices) {
  let minimum = HUGE, maximum = -HUGE;
  for (let i = 0; i < vertices.length; ++i) {
    let normal_dot_vertex = normal.dot(vertices[i]);
    minimum = Math.min(minimum, normal_dot_vertex);
    maximum = Math.max(maximum, normal_dot_vertex);
  }
  return [minimum, maximum];
}


// helper function for is_overlap
function is_between(range_1, range_2) {
  return (range_2[0] <= range_1[0] && range_1[0] <= range_2[1]) ||
         (range_2[0] <= range_1[1] && range_1[1] <= range_2[1]);
}


// with the SAT projection ranges, check if two object ranges are overlapping
function is_overlap(object_1_range, object_2_range) {
  return is_between(object_1_range, object_2_range) || is_between(object_2_range, object_1_range);
}


// uses the separating axis theorem to check for overlap
function is_colliding(object_1, object_2) {
  // get face normal vectors of the bounding boxes of both shapes
  let normals = object_1.bounding.normals.concat(object_2.bounding.normals);
  // note that the bounding normals and vertices are already in world space (check Object class for how it is done)

  for (let i = 0; i < normals.length; ++i) {
    // for each normal, project the vertices of the bounding boxes of object 1 and 2 to said normal
    let object_1_range = separating_axis_projection(normals[i], object_1.bounding.vertices);
    let object_2_range = separating_axis_projection(normals[i], object_2.bounding.vertices);
    // if the projected minimum and maximum ranges are overlapping for ALL normals, then the two objects are colliding
    if (!is_overlap(object_1_range, object_2_range)) {
      return false;
    }
  }
  return true
}


// vector equals with a small tolerance (magnitude of ERROR_SMALL)
function vector_equals(vector_1, vector_2) {
  return vector_1.minus(vector_2).norm() < ERROR_SMALL;
}


export class Object {
  constructor({ shape, material, bounding_exact=false,
                position, velocity, acceleration,
                scale, rotation,
                color }={}) {
    this.shape = shape;
    this.material = material;
    this.transform = Mat4.identity();  // transformation matrix for object itself

    this.position = position? position : vec3(0.0, 0.0, 0.0);
    this.velocity = velocity? velocity : vec3(0.0, 0.0, 0.0);
    this.acceleration = acceleration? acceleration : GRAVITY;

    this.scale = scale? scale : vec3(1.0, 1.0, 1.0);
    this.rotation = rotation? rotation : vec4(0.0, 1.0, 0.0, 0.0);

    this.color = color? color : hex_color("#aaaaaa");

    // true if bounding box is exactly the shape itself, should only be true for rectangular prisms (Cube)
    this.bounding_exact = bounding_exact? bounding_exact : this.shape instanceof defs.Cube;
    this.bounding = {
      // transformation matrix for bounding box (same as this.transform for rectangular prisms)
      transform: Mat4.identity(),
      vertices: [],  // vertices for bounding box (world space)
      normals: [],  // normals for bounding box (world space), directionally unique (no parallel normals)
      box: new Bounding_Box(hex_color("#ffff55")),  // bounding box object (to be drawn)
      shader: new Material(new defs.Basic_Shader()),  // basic shader
    };
  }

  draw_object({ context, program_state, update=true,
                delta_time, pre_transform, post_transform,
                draw_bounding=true }={}) {
    if (update && delta_time < 0.05) {  // update position, velocity, acceleration, etc.
      this.update({
        delta_time: delta_time, pre_transform: pre_transform, post_transform: post_transform,
      });
    }
    this.shape.draw(context, program_state, this.transform, this.material.override({color: this.color}));
    if (draw_bounding) {
      this.bounding.box.draw(context, program_state, this.bounding.transform, this.bounding.shader, "LINES");
    }
  }

  // ***** POSITION UPDATE *****

  update({ delta_time,
           pre_transform=null, post_transform=null,
           bounding=true }) {
    this.update_velocity(delta_time);
    this.update_position(delta_time);
    this.update_transform(pre_transform, post_transform);
    if (bounding) {  // update bounding box AFTER shape transformation update
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
    if (this.bounding_exact) {  // we assume this.bounding_exact true only if shape is rectangular prism
      this.bounding.transform = this.transform;
    } else {
      // convert vertices of shape from object to world space
      let vertices = this.shape.arrays.position.map(vertex => this.transform.times(vertex.to4(1.0)).to3());
      let length = vertices.length;
      // separate x, y, and z vertex coordinates, for loop slightly faster than using .map()
      let vertices_x = new Array(length), vertices_y = new Array(length), vertices_z = new Array(length);
      for (let i = 0; i < length; ++i) {
        [vertices_x[i], vertices_y[i], vertices_z[i]] = [vertices[i][0], vertices[i][1], vertices[i][2]];
      }

      // find minimum and maximum x, y, and z
      let minimum_position = vec3(Math.min(...vertices_x), Math.min(...vertices_y), Math.min(...vertices_z));
      let maximum_position = vec3(Math.max(...vertices_x), Math.max(...vertices_y), Math.max(...vertices_z));

      let scale = maximum_position.minus(minimum_position).times(0.5);
      let position = maximum_position.plus(minimum_position).times(0.5);
      this.bounding.transform = Mat4.identity()  // get bounding box transformation matrix
        .times(Mat4.translation(...position))
        .times(Mat4.scale(...scale));
    }

    // compute list of (non-parallel) world-space vertices and normals for the bounding box
    // normals are non-parallel to avoid repeated computation as they are for taking projections (for ranges) only
    // see is_colliding() for more information
    this.bounding.vertices = this.bounding.box.arrays.position.map(
      vertex => this.bounding.transform.times(vertex.to4(1.0)).to3()
    );
    let bounding_transform_inverse_transpose = Mat4.inverse(this.bounding.transform).transposed();
    this.bounding.normals = [];
    for (let i = 0; i < this.bounding.box.arrays.normal.length; ++i) {
      this.add_no_parallel(  // remove parallel vectors
        this.bounding.normals,
        bounding_transform_inverse_transpose.times(this.bounding.box.arrays.normal[i].to4(0.0)).to3().normalized()
      );
    }
  }

  add_no_parallel(array, vector) {  // array and vector type must match, vec3 or vec4
    for (let i = 0; i < array.length; ++i) {
      if (vector_equals(array[i], vector) || vector_equals(array[i], vector.times(-1.0))) {
        return;
      }
    }
    array.push(vector);
  }
}


class Bounding_Box extends defs.Cube {
  constructor(color_box=hex_color("#ffffff")) {
    super("position", "normal", "color");
    let vertices = [
      [-1, -1, -1], [-1, -1, 1], [-1, 1, -1], [-1, 1, 1], [1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1],
    ];
    let indices = [0, 1, 0, 2, 1, 3, 2, 3, 4, 5, 4, 6, 5, 7, 6, 7, 0, 4, 1, 5, 2, 6, 3, 7];
    this.arrays.position = indices.map(index => vec3(...vertices[index]));
    this.arrays.color = Array(24).fill(color_box);
    this.indices = false;
  }
}
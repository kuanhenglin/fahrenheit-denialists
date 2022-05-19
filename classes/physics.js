import {defs, tiny} from "./common.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


const GRAVITY = vec3(0.0, -9.81, 0.0);
const DAMPEN = 0.70;
const ERROR = 0.0001;
const ERROR_SMALL = 0.0000001;
const HUGE = 999999999.9;


// ***** COLLISION *****

// Collision detection: https://gamedev.stackexchange.com/a/60225 (separating axis theorem)
// Collision axis overlap: https://stackoverflow.com/a/36035369
// Collision normal: https://research.ncl.ac.uk/game/mastersdegree/gametechnologies/physicstutorials/4collisiondetection/Physics%20-%20Collision%20Detection.pdf
// Collision resolution: http://www.cs.uu.nl/docs/vakken/mgp/2014-2015/Lecture%207%20-%20Collision%20Resolution.pdf

// collision function which is called by the main scene, takes in array of objects
// note that the current way of checking collision is slow
export function collision(objects) {
  for (let i = 0; i < objects.length; ++i) {
    for (let j = i + 1; j < objects.length; ++j) {
      if (!(objects[i].wall && objects[j].wall)) {
        let collision_normal = collision_detection(objects[i], objects[j]);
        if (collision_normal) {
          collision_resolution(objects[i], objects[j], collision_normal);
          [objects[i].collision, objects[j].collision] = [true, true];
        } else {
          [objects[i].collision, objects[j].collision] = [false, false];
        }
      }
    }
  }
}


// ***** COLLISION DETECTION *****

// uses the separating axis theorem to check for overlap
function collision_detection(object_1, object_2) {
  // get face normal vectors of the bounding boxes of both shapes
  let normals = object_1.bounding.normals.concat(object_2.bounding.normals);
  // note that the bounding normals and vertices are already in world space (check Object class for how it is done)

  let overlap_minimum = null;
  for (let i = 0; i < normals.length; ++i) {
    // for each normal, project the vertices of the bounding boxes of object 1 and 2 to said normal
    let object_1_range = separating_axis_projection(normals[i], object_1.bounding.vertices);
    let object_2_range = separating_axis_projection(normals[i], object_2.bounding.vertices);
    // if the projected minimum and maximum ranges are overlapping for ALL normals, then the two objects are colliding
    let overlap = get_overlap(object_1_range, object_2_range);
    if (overlap <= 0) {  // no overlap between some axis
      return null;
    }
    if (!overlap_minimum || overlap < overlap_minimum.overlap) {
      overlap_minimum = {overlap: overlap, normal: normals[i]};
    }
  }
  return overlap_minimum
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

// with the SAT projection ranges, compute the amount that two object ranges are overlapping
// get_overlap() returns a non-positive number if the two objects are not overlapping
function get_overlap(object_1_range, object_2_range) {
  return Math.min(object_1_range[1], object_2_range[1]) - Math.max(object_1_range[0], object_2_range[0]);
}

// vector equals with a small tolerance (magnitude of ERROR_SMALL)
function vector_equals(vector_1, vector_2) {
  return vector_1.minus(vector_2).norm() < ERROR_SMALL;
}


// ***** COLLISION RESOLUTION *****

function collision_resolution(object_1, object_2, collision_normal) {
  let mass_inverse_1 = object_1.mass === -1.0? 0.0 : 1 / object_1.mass;  // mass is infinity
  let mass_inverse_2 = object_2.mass === -1.0? 0.0 : 1 / object_2.mass;
  let friction_coefficient = Math.max(object_1.friction_coefficient, object_2.friction_coefficient);
    let restitution = Math.min(object_1.restitution, object_2.restitution);

  let object_position = object_2.position.minus(object_1.position);
  let normal = collision_normal.normal;
  if (normal.dot(object_position) < 0) {  // normal always points from object 1 to object 2 (IMPORTANT!!!)
    normal = normal.times(-1.0);
  }

  let object_velocity = object_1.velocity.minus(object_2.velocity);
  let friction_1 = object_1.velocity.minus(normal.times(object_1.velocity.dot(normal)));
  let friction_2 = object_2.velocity.minus(normal.times(object_2.velocity.dot(normal)));

  let impulse = -(1 + restitution) * object_velocity.dot(normal) / (mass_inverse_1 + mass_inverse_2);
  let impulse_1 = normal.plus(friction_1.times(friction_coefficient)).times(impulse * mass_inverse_1);
  let impulse_2 = normal.plus(friction_2.times(friction_coefficient)).times(impulse * mass_inverse_2);

  object_1.velocity = object_1.velocity.plus(impulse_1);
  object_2.velocity = object_2.velocity.minus(impulse_2);

  if (object_1.wall) {  // if object 1 is a wall, push object 2 by full overlap amount
    object_2.position = object_2.position.plus(normal.times(collision_normal.overlap));
  } else if (object_2.wall) {  // ^ vice versa
    object_1.position = object_1.position.minus(normal.times(collision_normal.overlap));
  } else {  // if neither are walls, then push both objects away each by half overlap amount
    object_1.position = object_1.position.minus(normal.times(0.5 * collision_normal.overlap));
    object_2.position = object_2.position.plus(normal.times(0.5 * collision_normal.overlap));
  }
}


// ***** CLASSES *****

export class Object {
  constructor({ shape, material, draw,
                bounding_type, bounding_scale,
                position, velocity, acceleration,
                rotation, rotation_velocity,
                scale, mass, friction_coefficient, restitution,
                gravity, wall,
                color }={}) {
    this.shape = shape;
    this.material = material;
    this.transform = Mat4.identity();  // transformation matrix for object itself

    this.draw = draw !== undefined? draw : true;

    this.wall = wall !== undefined? wall : false;
    this.gravity = gravity !== undefined? gravity : GRAVITY;

    this.position = position !== undefined? position : vec3(0.0, 0.0, 0.0);
    this.velocity = velocity !== undefined? velocity : vec3(0.0, 0.0, 0.0);
    this.acceleration = acceleration !== undefined? acceleration.plus(this.gravity) : this.gravity;

    this.rotation = rotation !== undefined? rotation : vec3(0.0, 0.0, 0.0);
    this.rotation_velocity = rotation_velocity !== undefined? rotation_velocity : vec3(0.0, 0.0, 0.0);

    this.scale = scale !== undefined? scale : vec3(1.0, 1.0, 1.0);
    this.mass = mass !== undefined? mass : 1.0;  // arbitrary unit, mass is infinity if value is -1.0

    this.friction_coefficient = friction_coefficient !== undefined? friction_coefficient : 0.03;
    this.restitution = restitution !== undefined? restitution : 0.8;  // (inelastic) 0 <= restitution <= 1 (elastic)

    this.color = color !== undefined? color : hex_color("#aaaaaa");

    // the following are descriptions of each of the bounding types
    // EXACT: follows the geometry of the object exactly, currently only works for rectangular prisms
    // MODEL: rectangular prism initialized in model space, rotates with model
    // AXIS_ALIGNED: rectangular prisms re-computed every update, always parallel to axis (no rotation)
    this.bounding_type = bounding_type !== undefined? bounding_type :
      this.shape instanceof defs.Cube? "EXACT" : "MODEL";
    this.bounding_scale = bounding_scale !== undefined? bounding_scale : vec3(1.0, 1.0, 1.0);
    this.bounding = {
      // transformation matrix for bounding box (same as this.transform for rectangular prisms)
      transform_base: this.get_axis_aligned_bounding(true)?.times(Mat4.scale(...this.bounding_scale)),
      transform: Mat4.identity(),
      vertices: [],  // vertices for bounding box (world space)
      normals: [],  // normals for bounding box (world space), directionally unique (no parallel normals)
      box: new Bounding_Box(hex_color("#ffff55")),  // bounding box object (to be drawn)
      shader: new Material(new defs.Basic_Shader()),  // basic shader
    };

    this.collision = false;
  }

  draw_object({ context, program_state, update=true,
                delta_time, pre_transform, post_transform,
                draw_bounding=true }={}) {
    if (update && delta_time < 0.05) {  // update position, velocity, acceleration, etc.
      this.update({
        delta_time: delta_time, pre_transform: pre_transform, post_transform: post_transform,
      });
    }
    if (this.draw) {
      this.shape.draw(context, program_state, this.transform, this.material.override({color: this.color}));
    }
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
    this.rotation = this.rotation.plus(this.rotation_velocity.times(delta_time));
  }

  update_velocity(delta_time) {
    let acceleration = this.acceleration;
    if (this.collision) {
      acceleration = acceleration.minus(this.gravity);
    }
    this.velocity = this.velocity.plus(acceleration.times(delta_time));
  }

  update_transform(pre_transform=null, post_transform=null) {
    let rotation_magnitude = this.rotation.norm();
    let rotation_axis = rotation_magnitude === 0.0? vec3(1.0, 1.0, 1.0) : this.rotation;

    this.transform = Mat4.identity()
      .times(post_transform? post_transform : Mat4.identity())
      .times(Mat4.translation(...this.position))
      .times(pre_transform? pre_transform : Mat4.identity())
      .times(Mat4.rotation(rotation_magnitude, ...rotation_axis))
      .times(Mat4.scale(...this.scale));
  }

  // ***** COLLISION *****

  update_bounding() {
    if (this.bounding_type === "EXACT" || this.shape.arrays.position.length === 0) {
      this.bounding.transform = this.transform.times(Mat4.scale(...this.bounding_scale));
    } else if (this.bounding_type === "MODEL") {
      if (!this.bounding.transform_base) {
        this.bounding.transform_base = this.get_axis_aligned_bounding(true);
      }
      let transform_base = this.bounding.transform_base? this.bounding.transform_base : Mat4.identity();
      this.bounding.transform = this.transform.times(transform_base)?.times(Mat4.scale(...this.bounding_scale));
    } else {
      this.bounding.transform = this.get_axis_aligned_bounding(false)
        .times(Mat4.scale(...this.bounding_scale));
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

  get_axis_aligned_bounding(object_space=false) {
    if (this.shape.arrays.position.length === 0) {
      return null;
    }
    // convert vertices of shape from object to world space
    let vertices = this.shape.arrays.position;
    if (!object_space) {
      vertices = vertices.map(vertex => this.transform.times(vertex.to4(1.0)).to3());
    }
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

    return Mat4.translation(...position).times(Mat4.scale(...scale));
  }

  add_no_parallel(array, vector, normalize=true) {  // array and vector type must match, vec3 or vec4
    for (let i = 0; i < array.length; ++i) {
      if (vector_equals(array[i], vector) || vector_equals(array[i], vector.times(-1.0))) {
        return;
      }
    }
    array.push(normalize? vector.normalized() : vector);
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
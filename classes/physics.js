import {defs, tiny} from "./common.js";


const {  // load common classes to the current scope
  Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


export const GRAVITY_MULTIPLIER = 3.0;  // ramp up gravity due to working on a much bigger scale
let GRAVITY = vec3(0.0, -9.81, 0.0).times(GRAVITY_MULTIPLIER);

const ROTATION_WEIGHT = 0.40;
const DAMPEN = 4.0;

const ERROR = 0.0001;
const ERROR_SMALL = 0.0000001;

const HUGE = 999999999.9;

const MAX_VELOCITY = 100.0;
const MAX_ROTATION_VELOCITY = 20.0;

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


const SHAPES = {
  bounding_box: new Bounding_Box(hex_color("#ffff55")),
}


export function update_gravity(new_gravity, objects) {
  for (let i = 0; i < objects.length; ++i) {
    if (!objects[i].gravity_custom) {
      objects[i].acceleration = objects[i].acceleration.minus(GRAVITY).plus(new_gravity);
    }
  }
  GRAVITY = new_gravity;
}


export function initialize_rotation_center(objects) {
  for (let i = 0; i < objects.length; ++i) {
    let center = get_center(objects[i]);
    for (let j = 0; j < objects[i].length; ++j) {
      objects[i][j].rotation_offset = objects[i][j].position.minus(center);
    }
  }
}


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
      if (!(objects[i][0].wall && objects[j][0].wall)) {  // we assume there are no wall non-wall groups
        let collision_normals = collision_test(objects[i], objects[j]);
        for (let k = 0; k < collision_normals.length; ++k) {
          collision_resolution(objects[i], objects[j], collision_normals[k]);
        }
      }
    }
  }
}


function collision_test(object_group_1, object_group_2) {
  let collision_normals = [];
  for (let i = 0; i < object_group_1.length; ++i) {
    for (let j = 0; j < object_group_2.length; ++j) {
      let collision_normal = collision_detection(object_group_1[i], object_group_2[j]);
      if (collision_normal) {
        collision_normal["object_pair"] = [i, j];
        collision_normals.push(collision_normal);
      }
    }
  }
  return collision_normals;
}


// ***** COLLISION DETECTION *****

// uses the separating axis theorem to check for overlap
function collision_detection(object_1, object_2) {
  // get face normal vectors of the bounding boxes of both shapes
  let normals = get_normals(object_1, object_2);
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

function get_normals(object_1, object_2) {
  let crosses = [];
  for (let i = 0; i < object_1.bounding.normals.length; ++i) {
    for (let j = 0; j < object_2.bounding.normals.length; ++j) {
      crosses.push(object_1.bounding.normals[i].cross(object_2.bounding.normals[j]).normalized());
    }
  }
  return object_1.bounding.normals.concat(object_2.bounding.normals, crosses);
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

function get_mass_inverse(object_group) {
  let mass = 0.0;
  for (let i = 0; i < object_group.length; ++i) {
    if (object_group[i].mass === -1.0) {  // mass is infinity
      return 0.0;
    }
    mass += object_group[i].mass;
  }
  return 1 / mass;
}

function get_center(object_group) {
  let mass = 0.0;
  let center = vec3(0.0, 0.0, 0.0);
  for (let i = 0; i < object_group.length; ++i) {
    center = center.plus(object_group[i].position.times(object_group[i].mass));
    mass += object_group[i].mass;
  }
  return center.times(1 / mass);
}

function collision_resolution(object_group_1, object_group_2, collision_normal) {
  // *** GET COLLISION OBJECT
  let object_pair = collision_normal["object_pair"];
  let [object_1, object_2] = [object_group_1[object_pair[0]], object_group_2[object_pair[1]]];

  // *** COEFFICIENTS ***
  let [mass_inverse_1, mass_inverse_2] = [get_mass_inverse(object_group_1), get_mass_inverse(object_group_2)];
  let friction_coefficient = Math.max(object_1.friction_coefficient, object_2.friction_coefficient);
  let restitution = Math.min(object_1.restitution, object_2.restitution);

  // *** ADJUST NORMAL ***
  let object_position = object_2.position.minus(object_1.position);
  let normal = collision_normal.normal;
  if (normal.dot(object_position) < 0) {  // normal always points from object 1 to object 2 (IMPORTANT!!!)
    normal = normal.times(-1.0);
  }

  // *** ROTATION VELOCITY ***
  let intersection_1 = vertex_average(intersecting_vertices(object_1, object_2));
  let intersection_2 = vertex_average(intersecting_vertices(object_2, object_1));

  let compute_rotation_velocity_1 = intersection_1 !== null && !object_1.wall && !!object_1.bounding.transform_base;
  let compute_rotation_velocity_2 = intersection_2 !== null && !object_2.wall && !!object_2.bounding.transform_base;

  let [inertia_inverse_1, object_intersection_1, rotation_impulse_1, object_group_1_position] =
    Array(4).fill(vec3(0.0, 0.0, 0.0));
  if (compute_rotation_velocity_1) {
    object_group_1_position = get_center(object_group_1);
    object_intersection_1 = object_group_1_position.minus(intersection_1).normalized();
    inertia_inverse_1 = get_inertia_group(object_group_1, true);
    rotation_impulse_1 = apply_inertia_impulse(object_intersection_1.cross(normal), inertia_inverse_1)
      .cross(object_intersection_1);
  }
  let [inertia_inverse_2, object_intersection_2, rotation_impulse_2, object_group_2_position] =
    Array(4).fill(vec3(0.0, 0.0, 0.0));
  if (compute_rotation_velocity_2) {
    object_group_2_position = get_center(object_group_2);
    object_intersection_2 = object_group_2_position.minus(intersection_2).normalized();
    inertia_inverse_2 = get_inertia_group(object_group_2, true);
    rotation_impulse_2 = apply_inertia_impulse(object_intersection_2.cross(normal), inertia_inverse_2)
      .cross(object_intersection_2);
  }

  // *** LINEAR IMPULSE ***
  let friction_1 = object_1.velocity.minus(normal.times(object_1.velocity.dot(normal)));
  let friction_2 = object_2.velocity.minus(normal.times(object_2.velocity.dot(normal)));

  let impulse = -(1 + restitution) * object_1.velocity.minus(object_2.velocity).dot(normal) /
    (mass_inverse_1 + mass_inverse_2 + (rotation_impulse_1.plus(rotation_impulse_2).dot(normal) * ROTATION_WEIGHT));

  let impulse_1 = normal.plus(friction_1.times(friction_coefficient)).times(impulse * mass_inverse_1);
  let impulse_2 = normal.plus(friction_2.times(friction_coefficient)).times(impulse * mass_inverse_2);

  for (let i = 0; i < object_group_1.length; ++i) {
    object_group_1[i].velocity = object_group_1[i].velocity.plus(impulse_1);
  }
  for (let i = 0; i < object_group_2.length; ++i) {
    object_group_2[i].velocity = object_group_2[i].velocity.minus(impulse_2);
  }

  // *** ROTATION IMPULSE ***
  if (compute_rotation_velocity_1) {
    for (let i = 0; i < object_group_1.length; ++i) {
      object_group_1[i].rotation_offset = object_group_1[i].position.minus(object_group_1_position);
      object_group_1[i].rotation_velocity = object_group_1[i].rotation_velocity.minus(apply_inertia_impulse(
        object_intersection_1.cross(normal.times(impulse)).times(ROTATION_WEIGHT), inertia_inverse_1
      ));
    }
  }
  if (compute_rotation_velocity_2) {
    for (let i = 0; i < object_group_2.length; ++i) {
      object_group_2[i].rotation_offset = object_group_2[i].position.minus(object_group_2_position);
      object_group_2[i].rotation_velocity = object_group_2[i].rotation_velocity.minus(apply_inertia_impulse(
        object_intersection_2.cross(normal.times(impulse)).times(ROTATION_WEIGHT), inertia_inverse_2
      ));
    }
  }

  // *** PREVENT OVERLAP ***
  minimum_translation_distance(object_group_1, object_group_2, normal, collision_normal.overlap);
}

function minimum_translation_distance(object_group_1, object_group_2, normal, overlap) {
  for (let i = 0; i < object_group_1.length; ++i) {
    object_group_1[i].position = object_group_1[i].position.minus(
      object_group_1[0].wall? vec3(0.0, 0.0, 0.0) : normal.times((object_group_2[0].wall? 1.0 : 0.5) * overlap)
    )
  }
  for (let i = 0; i < object_group_2.length; ++i) {
    object_group_2[i].position = object_group_2[i].position.plus(
      object_group_2[0].wall? vec3(0.0, 0.0, 0.0) : normal.times((object_group_1[0].wall? 1.0 : 0.5) * overlap)
    )
  }
}

function apply_inertia_impulse(rotation_impulse, inertia_inverse) {
  return vec3(...rotation_impulse.map((x, i) => x * inertia_inverse[i]));
}

function get_inertia_group(object_group, inverse=true) {
  let inertia = vec3(0.0, 0.0, 0.0);
  for (let i = 0; i < object_group.length; ++i) {
    if (object_group[i].bounding_type === "EXACT" || object_group[i].bounding_type === "MODEL") {
      let rotation_magnitude = object_group[i].rotation.norm();
      let rotation_transform = Mat4.rotation(
        rotation_magnitude, ...(rotation_magnitude === 0.0? [1.0, 0.0, 0.0] : object_group[i].rotation)
      );
      inertia = inertia.plus(rotation_transform.times(get_inertia(object_group[i]).to4(0.0)).to3());
    } else if (object_group[i].bounding_type === "AXIS_ALIGNED") {
      inertia = inertia.plus(get_inertia(object_group[i]));
    }
  }
  if (inverse) {
    return vec3(...inertia.map(x => 1 / x));
  }
  return inertia;
}

function get_inertia(object) {
  let scale = vec3(0.0, 0.0, 0.0);
  if (object.bounding_type === "EXACT" || object.bounding_type === "MODEL") {
    scale = object.bounding.transform_base.times(object.scale.to4(0.0)).to3();
  } else if (object.bounding_type === "AXIS_ALIGNED") {
    scale = vec3(object.bounding.transform[0][0], object.bounding.transform[1][1], object.bounding.transform[2][2]);
  }
  return vec3(scale[1]**2 + scale[2]**2, scale[0]**2 + scale[2]**2, scale[0]**2 + scale[1]**2)
    .times(object.mass / 12);
}

function intersecting_vertices(object_1, object_2) {
  let object_2_transform_inverse = Mat4.inverse(object_2.bounding.transform);
  let object_1_vertices_projected = object_1.bounding.vertices.map(
    vertex => object_2_transform_inverse.times(vertex.to4(1.0)).to3()
  );
  let intersections_projected = [];
  for (let i = 0; i < object_1_vertices_projected.length; i += 2) {
    intersections_projected.push(
      ...get_intersections(object_1_vertices_projected[i], object_1_vertices_projected[i + 1])
    );
  }
  return intersections_projected.map(
    intersection => object_2.bounding.transform.times(intersection.to4(1.0)).to3()
  );
}

function get_intersections(vertex_1, vertex_2) {
  let distances = [
    [vertex_1[0] + 1, vertex_2[0] + 1], [vertex_1[1] + 1, vertex_2[1] + 1], [vertex_1[2] + 1, vertex_2[2] + 1],
    [vertex_1[0] - 1, vertex_2[0] - 1], [vertex_1[1] - 1, vertex_2[1] - 1], [vertex_1[2] - 1, vertex_2[2] - 1],
  ];
  let intersections = [];
  for (let i = 0; i < 6; ++i) {
    let intersection = vertex_1.plus(
      vertex_2.minus(vertex_1).times(-distances[i][0] / (distances[i][1] - distances[i][0]))
    );
    if (in_bounding(intersection, i % 3)) {
      intersections.push(intersection);
    }
  }
  return intersections;
}

function in_bounding(intersection, axis) {
  return (axis === 0 || (-1 < intersection[0] && intersection[0] < 1)) &&
    (axis === 1 || (-1 < intersection[1] && intersection[1] < 1)) &&
    (axis === 2 || (-1 < intersection[2] && intersection[2] < 1));
}

function vertex_average(vertices) {
  if (vertices.length === 0) {
    return null;
  }
  let sum = vec3(0.0, 0.0, 0.0);
  for (let i = 0; i < vertices.length; ++i) {
    sum = sum.plus(vertices[i]);
  }
  return sum.times(1 / vertices.length);
}


// ***** CLASSES *****

export class Object {
  constructor({ shape, material, draw,
                bounding_type, bounding_scale,
                position, velocity, acceleration,
                rotation_model, rotation, rotation_velocity, rotation_acceleration,
                scale, mass, friction_coefficient, restitution,
                gravity, wall,
                color }={}) {
    this.shape = shape;
    this.material = material;
    this.transform = Mat4.identity();  // transformation matrix for object itself

    this.draw = draw !== undefined? draw : true;

    this.wall = wall !== undefined? wall : false;
    this.gravity_custom = gravity !== undefined;
    this.gravity = this.gravity_custom? gravity : GRAVITY;

    this.position = position !== undefined? position : vec3(0.0, 0.0, 0.0);
    this.velocity = velocity !== undefined? velocity : vec3(0.0, 0.0, 0.0);
    this.acceleration = acceleration !== undefined? acceleration.plus(this.gravity) : this.gravity;

    this.rotation_model = rotation_model !== undefined? rotation_model : vec3(0.0, 0.0, 0.0);

    this.rotation = rotation !== undefined? rotation : vec3(0.0, 0.0, 0.0);
    this.rotation_velocity = rotation_velocity !== undefined? rotation_velocity : vec3(0.0, 0.0, 0.0);
    this.rotation_acceleration = rotation_acceleration !== undefined? rotation_acceleration : vec3(0.0, 0.0, 0.0);

    this.rotation_offset = vec3(0.0, 0.0, 0.0);

    this.scale = scale !== undefined? scale : vec3(1.0, 1.0, 1.0);
    this.mass = mass !== undefined? mass : 1.0;  // arbitrary unit, mass is infinity if value is -1.0

    this.friction_coefficient = friction_coefficient !== undefined? friction_coefficient : 0.03;
    this.restitution = restitution !== undefined? restitution : 0.7;  // (inelastic) 0 <= restitution <= 1 (elastic)

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
      box: SHAPES.bounding_box,  // bounding box object (to be drawn)
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
    // wrap rotation every 2 pi magnitude
    if (Math.floor(this.rotation.norm() / Math.PI / 2) > 1) {
      this.rotation = this.rotation.minus(
        this.rotation.normalized().times(Math.PI * 2 * Math.floor(this.rotation.norm() / Math.PI / 2))
      );
    }
    this.rotation = this.rotation.plus(this.rotation_velocity.times(delta_time));
  }

  update_velocity(delta_time) {
    this.velocity = this.velocity.plus(this.acceleration.times(delta_time));
    this.rotation_velocity = this.rotation_velocity.plus(this.rotation_acceleration.times(delta_time));
    if (!this.wall) {
      this.rotation_velocity = this.rotation_velocity.times(Math.max(0.0, 1 - (DAMPEN * delta_time)));
    }
    this.clip_velocity();
  }

  update_transform(pre_transform=null, post_transform=null) {
    let rotation_magnitude = this.rotation.norm();
    let rotation_axis = rotation_magnitude === 0.0? vec3(1.0, 1.0, 1.0) : this.rotation;
    let rotation_magnitude_model = this.rotation_model.norm();
    let rotation_axis_model = rotation_magnitude_model === 0.0? vec3(1.0, 1.0, 1.0) : this.rotation_model;

    this.transform = Mat4.identity()
      .times(post_transform? post_transform : Mat4.identity())
      .times(Mat4.translation(...this.position))
      .times(pre_transform? pre_transform : Mat4.identity())
      .times(Mat4.translation(...this.rotation_offset.times(-1.0)))
      .times(Mat4.rotation(rotation_magnitude, ...rotation_axis))
      .times(Mat4.translation(...this.rotation_offset))
      .times(Mat4.rotation(rotation_magnitude_model, ...rotation_axis_model))
      .times(Mat4.scale(...this.scale));
  }

  clip_velocity() {
    if (this.velocity.norm() > MAX_VELOCITY) {
      this.velocity = this.velocity.normalized().times(MAX_VELOCITY);
    }
    if (this.rotation_velocity.norm() > MAX_ROTATION_VELOCITY) {
      this.rotation_velocity = this.rotation_velocity.normalized().times(MAX_ROTATION_VELOCITY);
    }
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
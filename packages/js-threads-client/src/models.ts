/**
 * Instance is a singular Model instance.
 */
export interface Instance<T> {
  instance: T
}

/**
 * InstanceList is an array of Entities.
 */
export interface InstanceList<T> {
  instancesList: T[]
}

/**
 * Value represents a valid JSON data type.
 */
export type Value = string | boolean | number

/**
 * JSONValue is used by the gRPC server to handle JSON data types.
 */
export interface JSONValue {
  string?: string
  bool?: boolean
  float?: number
}

/**
 * JSONOperation defines the set of possible operations to be used in a Query.
 */
export enum JSONOperation {
  Eq = 0,
  Ne,
  Gt,
  Lt,
  Ge,
  Le,
}

/**
 * JSONCriterion represents a single Query criteria.
 */
export interface JSONCriterion {
  fieldPath?: string
  operation?: JSONOperation
  value?: JSONValue
  query?: JSONQuery
}

/**
 * JSONSort describes how and what field on which to sort a query.
 */
export interface JSONSort {
  fieldPath: string
  desc: boolean
}

/**
 * JSONQuery represents a single store Query.
 */
export interface JSONQuery {
  ands?: JSONCriterion[]
  ors?: JSONQuery[]
  sort?: JSONSort
}

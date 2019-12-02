// export type JSONValue = string | boolean | number

export interface JSONValue {
  string?: string
  bool?: boolean
  float?: number
}

export enum JSONOperation {
  Eq = 0,
  Ne,
  Gt,
  Lt,
  Ge,
  Le,
}

export interface JSONCriterion {
  fieldPath?: string
  operation?: JSONOperation
  value?: JSONValue
  query?: JSONQuery
}

export interface JSONSort {
  fieldPath: string
  desc: boolean
}

export interface JSONQuery {
  ands?: JSONCriterion[]
  ors?: JSONQuery[]
  sort?: JSONSort
}

const _: JSONQuery = {
  ands: [
    {
      fieldPath: 'lastName',
      operation: JSONOperation.Eq,
      value: { string: 'Farmer' },
    },
  ],
}

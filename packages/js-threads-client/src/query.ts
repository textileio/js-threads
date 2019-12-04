import { JSONQuery, JSONSort, JSONCriterion, JSONOperation, JSONValue, Value } from './models'

const valueToJSONValue = (value: Value): JSONValue => {
  switch (typeof value) {
    case 'string':
      return { string: value }
    case 'boolean':
      return { bool: value }
    case 'number':
      return { float: value }
    default:
      throw new Error('unsupported JSON value type')
  }
}

// Criterion is a partial condition that can specify comparison operator for a field.
export class Criterion implements JSONCriterion {
  constructor(
    public fieldPath: string,
    public operation?: JSONOperation,
    public value?: JSONValue,
    public query?: Query,
  ) {}

  // Eq is an equality operator against a field
  eq(value: Value): Query {
    return this.create(JSONOperation.Eq, value)
  }

  // Ne is a not equal operator against a field
  ne(value: Value): Query {
    return this.create(JSONOperation.Ne, value)
  }

  // Gt is a greater operator against a field
  gt(value: Value): Query {
    return this.create(JSONOperation.Ne, value)
  }

  // Lt is a less operation against a field
  lt(value: Value): Query {
    return this.create(JSONOperation.Lt, value)
  }

  // Ge is a greater or equal operator against a field
  ge(value: Value): Query {
    return this.create(JSONOperation.Ge, value)
  }

  // Le is a less or equal operator against a field
  le(value: Value): Query {
    return this.create(JSONOperation.Le, value)
  }

  create(op: JSONOperation, value: Value): Query {
    this.operation = op
    this.value = valueToJSONValue(value)
    if (this.query === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      this.query = new Query()
    }
    this.query.ands.push(this)
    return this.query
  }

  // toJSON converts the Criterion to JSONCriterion, dropping circular references to internal Queries
  toJSON(): JSONCriterion {
    const { query, ...rest } = this
    return rest
  }
}

// Alias Criterion to Where for a slightly nicer API (see example below)
const Where = Criterion

// Export Where for external callers
export { Where }

// Query allows to build queries to be used to fetch data from a model.
export class Query implements JSONQuery {
  // Query creates a new generic query object.
  constructor(public ands: JSONCriterion[] = [], public ors: JSONQuery[] = [], public sort?: JSONSort) {}

  // Where starts to create a query condition for a field
  static where(fieldPath: string): Criterion {
    return new Criterion(fieldPath)
  }

  // And concatenates a new condition in an existing field.
  and(fieldPath: string): Criterion {
    return new Criterion(fieldPath, undefined, undefined, this)
  }

  // Or concatenates a new condition that is sufficient
  // for an instance to satisfy, independant of the current Query.
  // Has left-associativity as: (a And b) Or c
  or(query: Query): Query {
    this.ors.push(query)
    return this
  }

  // OrderBy specify ascending order for the query results.
  // On multiple calls, only the last one is considered.
  orderBy(fieldPath: string): Query {
    this.sort = { fieldPath, desc: false }
    return this
  }

  // OrderByDesc specify descending order for the query results.
  // On multiple calls, only the last one is considered.
  orderByDesc(fieldPath: string): Query {
    this.sort = { fieldPath, desc: true }
    return this
  }
}

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

/**
 * Criterion is a partial condition that can specify comparison operator for a field.
 */
export class Criterion implements JSONCriterion {
  constructor(
    public fieldPath: string,
    public operation?: JSONOperation,
    public value?: JSONValue,
    public query?: Query,
  ) {}

  /**
   * eq is an equality operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  eq(value: Value): Query {
    return this.create(JSONOperation.Eq, value)
  }

  /**
   * ne is a not equal operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  ne(value: Value): Query {
    return this.create(JSONOperation.Ne, value)
  }

  /**
   * gt is a greater operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  gt(value: Value): Query {
    return this.create(JSONOperation.Ne, value)
  }

  /** lt is a less operation against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  lt(value: Value): Query {
    return this.create(JSONOperation.Lt, value)
  }

  /** ge is a greater or equal operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  ge(value: Value): Query {
    return this.create(JSONOperation.Ge, value)
  }

  /** le is a less or equal operator against a field
   * @param value The value to query against. Must be a valid JSON data type.
   */
  le(value: Value): Query {
    return this.create(JSONOperation.Le, value)
  }

  /**
   * create updates this Criterion with a new Operation and returns the corresponding query.
   * @param op
   * @param value
   */
  private create(op: JSONOperation, value: Value): Query {
    this.operation = op
    this.value = valueToJSONValue(value)
    if (this.query === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      this.query = new Query()
    }
    this.query.ands.push(this)
    return this.query
  }

  /**
   * toJSON converts the Criterion to JSONCriterion, dropping circular references to internal Queries.
   */
  toJSON(): JSONCriterion {
    const { query, ...rest } = this
    return rest
  }
}

/**
 * Alias Criterion to Where for a slightly nicer API (see example below)
 */
const Where = Criterion

// Export Where for external callers
export { Where }

/**
 * Query allows to build queries to be used to fetch data from a model.
 */
export class Query implements JSONQuery {
  /**
   * Query creates a new generic query object.
   * @param ands An array of top-level Criterions to be included in the query.
   * @param ors An array of internal queries.
   * @param sort An object describing how to sort the query.
   */
  constructor(public ands: JSONCriterion[] = [], public ors: JSONQuery[] = [], public sort?: JSONSort) {}

  /**
   * where starts to create a query condition for a field
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  static where(fieldPath: string): Criterion {
    return new Criterion(fieldPath)
  }

  /**
   * and concatenates a new condition in an existing field.
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  and(fieldPath: string): Criterion {
    return new Criterion(fieldPath, undefined, undefined, this)
  }

  /**
   * or concatenates a new condition that is sufficient for an instance to satisfy, independant of the current Query. Has left-associativity as: (a And b) Or c
   * @param query The 'sub-query' to concat to the existing query.
   */
  or(query: Query): Query {
    this.ors.push(query)
    return this
  }

  /**
   * orderBy specify ascending order for the query results. On multiple calls, only the last one is considered.
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  orderBy(fieldPath: string): Query {
    this.sort = { fieldPath, desc: false }
    return this
  }

  /**
   * orderByDesc specify descending order for the query results. On multiple calls, only the last one is considered.
   * @param fieldPath The field name to query on. Can be a hierarchical path.
   */
  orderByDesc(fieldPath: string): Query {
    this.sort = { fieldPath, desc: true }
    return this
  }
}

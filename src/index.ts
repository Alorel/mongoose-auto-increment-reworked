import debug = require('debug');
import {Document, model, Model, Schema, SchemaTypeOpts} from 'mongoose';
import {LazyGetter} from 'typescript-lazy-get-decorator';

/** Static configuration */
const enum Conf {
  RETRY_TIMEOUT = 5
}

/**
 * The model interface
 * @internal
 */
export interface IdCounterModel {
  /** Current counter */
  c: number;
  /** Field name */
  f: string;
  /** Model name */
  m: string;
}

/** Default options */
let defaultOptions: PluginOptions = {
  field: '_id',
  incrementBy: 1,
  nextCount: '_nextCount',
  resetCount: '_resetCount',
  startAt: 1,
  unique: true
};

/**
 * Document interface
 * @internal
 */
export interface IdCounterDocument extends IdCounterModel, Document {
}

/** Debug logger */
const log = debug('mongoose-auto-increment-reworked');

/** Function for getting the next counter value */
export type NextCountFunction = () => Promise<number>;

/** Function for resetting the current counter value */
export type ResetCountFunction = NextCountFunction;

/** Plugin configuration */
export interface PluginOptions {
  /**
   * The field that will be automatically incremented. Do not define this in your schema.
   * @default _id
   */
  field: string;
  /**
   * How much every insert should increment the counter by
   * @default 1
   */
  incrementBy: number;
  /**
   * The name of the function for getting the next ID number.
   * Set this to false to prevent the function from being added to the schema's static and instance methods.
   * @default _nextCount
   */
  nextCount: string | false;
  /**
   * The name of the function for resetting the ID number
   * Set this to false to prevent the function from being added to the schema's static and instance methods.
   * @default _resetCount
   */
  resetCount: string | false;
  /**
   * The first number that will be generated
   * @default 1
   */
  startAt: number;
  /**
   * Whether or not to add a unique index on the field. This option is ignored if the field name is _id.
   * @default true
   */
  unique: boolean;
}

/** Plugin options when applying via schema.plugin() */
export interface SchemaPluginOptions extends Partial<PluginOptions> {
  modelName: string;
}

/**
 * A plugin instance's ready state
 * @internal
 */
export interface ReadyState {
  /** Any error, if thrown */
  error?: Error;
  /** Ready promise */
  promise: Promise<void>;
  /** Whether or not the plugin has finished initialising */
  ready?: true;
}

/** Ready states mappings */
interface ReadyStates {
  [modelName: string]: ReadyState;
}

/** Map containing ready states */
const readyMap = new WeakMap<Schema, ReadyStates>();

/** Mongoose plugin for automatically generating auto-incrementing IDs */
export class MongooseAutoIncrementID {
  /** Name of the model used by the plugin */
  private static modelName = 'IdCounter';
  /** User-provided options */
  private readonly _options: Partial<PluginOptions>;
  /** Name of the model we're working with */
  private readonly model: string;
  /** Schema to apply the plugin to. */
  private readonly schema: Schema;

  /**
   * Create a new plugin instance
   * @param schema Schema to apply the plugin to. Must be an instance of Mongoose Schema
   * @param modelName Name of the model that this schema will use.
   * @param options Plugin configuration
   * @throws {TypeError} If schema is not given or is not an instance of Mongoose Schema
   * @throws {TypeError} If modelName is not given or is not a string
   */
  public constructor(schema: Schema,
                     modelName: string,
                     options: Partial<PluginOptions> = {}) {

    debug('Constructing');
    if (!schema || !(schema instanceof Schema)) {
      throw new TypeError('Schema is required and must be an instance of Mongoose Schema');
    }
    if (!modelName || typeof modelName !== 'string') {
      throw new TypeError('Model name must be a string');
    }

    debug(`Model name set to ${modelName}`);
    this.model = modelName;
    this.schema = schema;
    this._options = options;
  }

  /** The model instance */
  @LazyGetter()
  private static get idCounter(): Model<IdCounterDocument> {
    log('Creating schema');
    /** Schema definition */
    const idCounterSchema = new Schema(
      {
        c: {
          default: 0,
          required: true,
          type: Number
        },
        f: {
          required: true,
          type: String
        },
        m: {
          required: true,
          type: String
        },
      },
      {
        autoIndex: true, // the collection will always be tiny; no problem if we autoIndex in production
        id: false,
        skipVersioning: true,
        timestamps: false,
        versionKey: false,
      }
    );

    log('Defining index');
    idCounterSchema.index({f: 1, m: 1}, {unique: true});

    log('Creating model instance');

    return model<IdCounterDocument>(MongooseAutoIncrementID.modelName, idCounterSchema);
  }

  /** Error, if any, thrown by applyPlugin() */
  public get error(): Error | undefined {
    return this.state.error;
  }

  /** Whether or not the initialisation has completed */
  public get isReady(): boolean {
    return !!this.state.ready;
  }

  /** Promise returned by applyPlugin() */
  public get promise(): Promise<void> {
    return this.state.promise;
  }

  /** Default arguments for querying the id counter collection */
  @LazyGetter()
  private get findArgs(): Readonly<Pick<IdCounterModel, 'f' | 'm'>> {
    const out: Pick<IdCounterModel, 'f' | 'm'> = {
      f: this.options.field,
      m: this.model
    };

    log('findArgs field defined as %s, model as %s', out.f, out.m);

    return Object.freeze(out);
  }

  /** The initial counter value */
  @LazyGetter()
  private get initialStart(): number {
    const ret: number = this.options.startAt - this.options.incrementBy;

    log('initialStart defined as %s', ret);

    return ret;
  }

  /** User-supplied options merged with defaults */
  @LazyGetter()
  private get options(): Readonly<PluginOptions> {
    const value: PluginOptions = MongooseAutoIncrementID.getDefaults();

    Object.assign(value, this._options);

    value.unique = !!<any>value.unique;

    for (const field of Object.keys(value)) {
      log('%s option defined as %s', field, value[field]);
    }

    return Object.freeze(value);
  }

  /** The plugin instante's ready state */
  @LazyGetter()
  private get state(): ReadyState {
    let states: ReadyStates = <ReadyStates>readyMap.get(this.schema);

    if (!states) {
      states = {};
      readyMap.set(this.schema, states);
    }

    let state: ReadyState = states[this.model];

    // istanbul ignore else
    if (!state) {
      state = <any>{};
      states[this.model] = state;
    }

    return state;
  }

  /** The default options used by the plugin */
  public static getDefaults(): PluginOptions {
    return Object.assign({}, defaultOptions);
  }

  /**
   * Get the initialisation error for the given schema and model
   * @param schema The schema
   * @param modelName The mode
   * @returns The initialisation error that occurred or undefined if the schema/model combination hasn't been plugged
   *   into yet or hasn't errored.
   */
  public static getErrorFor(schema: Schema, modelName: string): Error | undefined {
    const state: ReadyState | undefined = MongooseAutoIncrementID.getStateFor(schema, modelName);

    if (state) {
      return state.error;
    }
  }

  /**
   * Get the initialisation promise for the given schema and model
   * @param schema The schema
   * @param modelName The mode
   * @returns The initialisation promise or undefined if the schema/model combination hasn't been plugged into yet.
   */
  public static getPromiseFor(schema: Schema, modelName: string): Promise<void> | undefined {
    const state: ReadyState | undefined = MongooseAutoIncrementID.getStateFor(schema, modelName);

    if (state) {
      return state.promise;
    }
  }

  /**
   * Set the model name this plugin will use. Has no effect if you have already applied the plugin to a schema.
   * @param modelName Name of the plugin model
   * @throws {TypeError} If model name is not a string. Won't happen if you omit the parameter.
   */
  public static initialise(modelName?: string): void {
    log('Performing static initialisation with name %s', modelName);
    if (modelName !== undefined) {
      if (typeof modelName !== 'string') {
        throw new TypeError('Model name must be a string');
      }

      MongooseAutoIncrementID.modelName = modelName;
    }

    // Perform no-op initialisation
    ((m: Model<IdCounterDocument>) => m)(MongooseAutoIncrementID.idCounter);
  }

  /**
   * Check if the given schema and model have finished their plugin initialisation
   * @param schema The schema
   * @param modelName The mode
   * @returns true if the initialisation completed successfully, false if it hasn't completed yet, it errored or hasn't
   *   started yet.
   */
  public static isReady(schema: Schema, modelName: string): boolean {
    const state: ReadyState | undefined = MongooseAutoIncrementID.getStateFor(schema, modelName);

    if (state) {
      return !!<any>state.ready;
    }

    return false;
  }

  /**
   * Handler for applying the plugin via schema.plugin()
   * @param schema The schema we're applying the plugin to
   * @param options Plugin options. This should be a {@link SchemaPluginOptions} object containing a modelName key and,
   * optionally, any of the other plugin options.
   */
  public static plugin(schema: Schema, options?: any): Promise<void> {
    if (!options) {
      throw new Error('Options are required');
    }

    const modelName: string = (<SchemaPluginOptions>options).modelName;

    if (!modelName) {
      throw new Error('Options must contain a "modelName" key');
    }

    return new MongooseAutoIncrementID(schema, modelName, options).applyPlugin();
  }

  /**
   * Set default options used by the plugin
   * @param newOpts The options
   * @throws If any parameter is invalid
   */
  public static setDefaults(newOpts: Partial<PluginOptions> = {}): void {
    const out: PluginOptions = Object.assign(MongooseAutoIncrementID.getDefaults(), newOpts);
    MongooseAutoIncrementID.validateOptions(out);
    defaultOptions = out;
  }

  /**
   * Internal static state getter
   * @param schema Schema we're getting the state for
   * @param modelName Model we're getting the state for
   * @returns The ready state or undefined if the state cannot be found
   */
  private static getStateFor(schema: Schema, modelName: string): ReadyState | undefined {
    const states: ReadyStates | undefined = readyMap.get(schema);

    if (states) {
      return states[modelName];
    }
  }

  /**
   * Validates the options supplied by the user
   * @param options The options to validate
   * @throws {TypeError} if a validation fails
   */
  private static validateOptions(options: PluginOptions): void {
    log('Validating options');
    if (!options) {
      throw new TypeError('Options missing');
    }

    log('Validating field');
    if (typeof options.field !== 'string') {
      throw new TypeError('field must be a string');
    }

    log('Validating incrementBy');
    if (typeof options.incrementBy !== 'number') {
      throw new TypeError('incrementBy must be a number');
    }

    log('Validating nextCount');
    if (typeof options.nextCount !== 'string' && options.nextCount !== false) {
      throw new TypeError('nextCount must be a string or false');
    }

    log('Validating resetCount');
    if (typeof options.resetCount !== 'string' && options.resetCount !== false) {
      throw new TypeError('resetCount must be a string or false');
    }

    log('Validating startAt');
    if (typeof options.startAt !== 'number') {
      throw new TypeError('startAt must be a number');
    }
  }

  /**
   * Apply the plugin to the given schema
   * @returns A void promise that resolves when the initialisation has completed. You do not need to wait for the
   *   promise to resolve - any document insertion queries will be queued until the initialisation completes. You
   *   should, however, catch any errors if this promise rejects.
   */
  public applyPlugin(): Promise<void> {
    log('Running plugin initialisation on %s', this.model);

    try {
      this.validateOptions();
      this.addFieldToSchema();
      this.addNextCount();
      this.addResetCount();
      this.addPreSave();

      this.state.promise = this.init()
        .catch((e: any) => {
          this.state.error = e;
          throw e;
        });

      return this.state.promise;
    } catch (e) {
      this.state.error = e;
      this.state.promise = Promise.reject(this.state.error);

      return this.state.promise;
    }
  }

  /**
   * Validates the options supplied by the user
   * @throws {TypeError} if a validation fails
   */
  public validateOptions(): void {
    MongooseAutoIncrementID.validateOptions(this.options);
  }

  /** Add the field containing our auto-incremented ID to the schema definition */
  private addFieldToSchema(): void {
    const fieldDef: SchemaTypeOpts<any> = {
      required: false,
      type: Number
    };

    if (this.options.field !== '_id') {
      fieldDef.unique = this.options.unique;
    }

    log('Field defined as %s', JSON.stringify(fieldDef));

    log('Adding field to %s schema', this.model);
    this.schema.add({[this.options.field]: fieldDef});
  }

  /** Add the next count function if enabled */
  private addNextCount(): void {
    if (this.options.nextCount) {
      log('Adding %s instance and static methods for %s', this.options.nextCount, this.model);
      const fn = () => {
        const exec = MongooseAutoIncrementID.idCounter.findOne(this.findArgs, {c: 1}).lean().exec();

        return (<Promise<IdCounterModel>>exec)
          .then((doc: IdCounterModel): number => {
            return doc === null ? this.options.startAt : doc.c + this.options.incrementBy;
          });
      };

      this.schema.static(this.options.nextCount, fn);
      this.schema.method(this.options.nextCount, fn);
    } else {
      log('Skipping nextCount methods for %s', this.model);
    }
  }

  /** Add the pre-save hook to the schema that will generate our IDs */
  private addPreSave(): void {
    // tslint:disable-next-line:no-this-assignment
    const self = this;

    log('Adding pre-save hook');
    this.schema.pre('save', function(this: Document, next: any): void {
      debug('Doc save hook triggered');

      // Only work with new documents
      if (this.isNew) {
        log('Document is new');

        // Plugin might not be ready yet. Define a save function
        const save = () => {
          if (self.isReady) {
            log('Plugin ready. Performing onSave logic.');

            // The payload contains a numeric value on the field. Update the ID counter collection if necessary.
            if (typeof this[self.options.field] === 'number') {
              log('%s is a number: %d', self.options.field, self.options.field);

              self.onSaveNumberField(this[self.options.field])
                .then(() => next())
                .catch(next);
            } else {
              log('%s is not a number: %s', self.options.field, JSON.stringify(this[self.options.field]));

              // Fiels does not contain an ID or is NaN. Generate the next value and set it on the payload.
              self.onSaveAnyField()
                .then((newCount: number): void => {
                  this[self.options.field] = newCount;
                  next();
                })
                .catch(next);
            }
          } else if (!self.error) {
            log('Plugin not ready yet; waiting for %d ms before retrying', Conf.RETRY_TIMEOUT);
            setTimeout(save, Conf.RETRY_TIMEOUT);
          } else {
            log('Failing; plugin initialisation rejected.');
            setImmediate(next, new Error('The initialisation promise rejected'));
          }
        };

        // Immediately call the save function
        setImmediate(save);
      } else {
        log('Document is not new; skipping.');
        setImmediate(next);
      }
    });
  }

  /** Add the reset count function if enabled */
  private addResetCount(): void {
    if (this.options.resetCount) {
      log('Adding %s instance and static methods for %s', this.options.resetCount, this.model);
      const fn = () => {
        return MongooseAutoIncrementID.idCounter
          .findOneAndUpdate(
            this.findArgs,
            {c: this.initialStart},
            {new: true, upsert: true, fields: {_id: 1}}
          )
          .lean()
          .then((): number => this.options.startAt);
      };

      this.schema.static(this.options.resetCount, fn);
      this.schema.method(this.options.resetCount, fn);
    } else {
      log('Skipping resetCount methods for %s', this.model);
    }
  }

  /** Initialise the counter for this schema */
  private init(): Promise<void> {
    log('Performing plugin initialisation');

    return MongooseAutoIncrementID.idCounter.findOne(this.findArgs, {_id: 1})
      .lean()
      .then((doc: any): void | Promise<void> => {
        if (!doc) { // No counter document found. Create one
          const payload: IdCounterModel = {
            c: this.initialStart,
            f: this.options.field,
            m: this.model
          };
          log('No counter document found for %s; creating with %s', this.model, JSON.stringify(payload));

          return MongooseAutoIncrementID.idCounter.create(payload)
            .then(() => {
              log('Counter document for %s created', this.model);
              this.state.ready = true;
            });
        } else {
          // All good
          this.state.ready = true;
        }
      });
  }

  /** Generate the next ID, update counter document, return ID */
  private onSaveAnyField(): Promise<number> {
    return (<Promise<IdCounterModel>>MongooseAutoIncrementID.idCounter
      .findOneAndUpdate(
        this.findArgs,
        {$inc: {c: this.options.incrementBy}},
        {new: true, setDefaultsOnInsert: true, upsert: true, fields: {c: 1}}
      )
      .lean()
      .exec())
      .then((doc: IdCounterModel): number => doc.c);
  }

  /** Synchronise the ID provided in the document with the database value */
  private onSaveNumberField(value: number): Promise<any> {
    return MongooseAutoIncrementID.idCounter
      .findOneAndUpdate(
        {f: this.options.field, m: this.model, c: {$lt: value}},
        {c: value},
        {new: true, fields: {_id: 1}}
      )
      .lean()
      .exec();
  }
}

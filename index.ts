import debug = require('debug');
import {Document, model, Model, Schema, SchemaTypeOpts} from 'mongoose';
import {LazyGetter} from 'typescript-lazy-get-decorator';

const enum Conf {
  RETRY_TIMEOUT = 5
}

/** @internal */
export interface IdCounterModel {
  c: number;
  f: string;
  m: string;
}

/** @internal */
export interface IdCounterDocument extends IdCounterModel, Document {
}

const log = debug('mongoose-auto-increment-reworked');

log('Creating schema');

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
    autoIndex: true,
    id: false,
    skipVersioning: true,
    timestamps: false,
    versionKey: false,
  }
);

log('Defining index');

idCounterSchema.index({f: 1, m: 1}, {unique: true});

// tslint:disable-next-line:variable-name
let IdCounter: Model<IdCounterDocument>;

export type NextCountFunction = () => Promise<number>;
export type ResetCountFunction = NextCountFunction;

export interface PluginOptions {
  field: string;
  incrementBy: number;
  nextCount: string | false;
  resetCount: string | false;
  startAt: number;
  unique: boolean;
}

export class MongooseAutoIncrementID {
  private static initialised = false;
  private readonly _options: Partial<PluginOptions>;
  private readonly model: string;
  private ready = false;
  private rejected = false;

  public constructor(private readonly schema: Schema,
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
    this._options = options;
  }

  @LazyGetter()
  private get findArgs(): Readonly<Pick<IdCounterModel, 'f' | 'm'>> {
    const out: Pick<IdCounterModel, 'f' | 'm'> = {
      f: this.options.field,
      m: this.model
    };

    log('findArgs field defined as %s, model as %s', out.f, out.m);

    return Object.freeze(out);
  }

  @LazyGetter()
  private get initialStart(): number {
    const ret: number = this.options.startAt - this.options.incrementBy;

    log('initialStart defined as %s', ret);

    return ret;
  }

  @LazyGetter()
  private get options(): Readonly<PluginOptions> {
    const value: PluginOptions = {
      field: '_id',
      incrementBy: 1,
      nextCount: '_nextCount',
      resetCount: '_resetCount',
      startAt: 1,
      unique: true
    };

    Object.assign(value, this._options);

    value.unique = !!<any>value.unique;

    for (const field of Object.keys(value)) {
      log('%s option defined as %s', field, value[field]);
    }

    return Object.freeze(value);
  }

  public static initialise(modelName = 'IdCounter'): void {
    log('Performing static initialisation with name %s', modelName);
    if (MongooseAutoIncrementID.initialised) {
      throw new Error('Already initialised');
    }
    if (!modelName || typeof modelName !== 'string') {
      throw new TypeError('Model name is required');
    }

    log('Creating model instance');
    IdCounter = model<IdCounterDocument>(modelName, idCounterSchema);
    MongooseAutoIncrementID.initialised = true;
  }

  public applyPlugin(): Promise<void> {
    log('Running plugin initialisation on %s', this.model);

    if (!MongooseAutoIncrementID.initialised) {
      return Promise.reject(new Error('The initialise method has not been called'));
    }

    try {
      this.validateOptions();
      this.addFieldToSchema();
      this.addNextCount();
      this.addResetCount();
      this.addPreSave();

      return this.init()
        .catch((e: any) => {
          this.rejected = true;
          throw e;
        });
    } catch (e) {
      this.rejected = true;

      return Promise.reject(e);
    }
  }

  public validateOptions(): void {
    log('Validating options');
    log('Validating field');
    if (typeof this.options.field !== 'string') {
      throw new TypeError('field must be a string');
    }

    log('Validating incrementBy');
    if (typeof this.options.incrementBy !== 'number') {
      throw new TypeError('incrementBy must be a number');
    }

    log('Validating nextCount');
    if (typeof this.options.nextCount !== 'string' && this.options.nextCount !== false) {
      throw new TypeError('nextCount must be a string or false');
    }

    log('Validating resetCount');
    if (typeof this.options.resetCount !== 'string' && this.options.resetCount !== false) {
      throw new TypeError('resetCount must be a string or false');
    }

    log('Validating startAt');
    if (typeof this.options.startAt !== 'number') {
      throw new TypeError('startAt must be a number');
    }
  }

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

  private addNextCount(): void {
    if (this.options.nextCount) {
      log('Adding %s instance and static methods for %s', this.options.nextCount, this.model);
      this.nextCountFn = this.nextCountFn.bind(this);

      this.schema.static(this.options.nextCount, this.nextCountFn);
      this.schema.method(this.options.nextCount, this.nextCountFn);
    } else {
      log('Skipping nextCount methods for %s', this.model);
    }
  }

  private addPreSave(): void {
    // tslint:disable-next-line:no-this-assignment
    const self = this;

    log('Adding pre-save hook');
    this.schema.pre('save', function(this: Document, next: any): void {
      debug('Doc save hook triggered');

      if (this.isNew) {
        log('Document is new');

        const save = () => {
          if (self.ready) {
            log('Plugin ready. Performing onSave logic.');

            if (typeof this[self.options.field] === 'number') {
              log('%s is a number: %d', self.options.field, self.options.field);

              self.onSaveNumberField(this[self.options.field])
                .then(() => next())
                .catch(next);
            } else {
              log('%s is not a number: %s', self.options.field, JSON.stringify(this[self.options.field]));

              self.onSaveAnyField()
                .then((newCount: number): void => {
                  this[self.options.field] = newCount;
                  next();
                })
                .catch(next);
            }
          } else if (!self.rejected) {
            log('Plugin not ready yet; waiting for %d ms before retrying', Conf.RETRY_TIMEOUT);
            setTimeout(save, Conf.RETRY_TIMEOUT);
          } else {
            log('Failing; plugin initialisation rejected.');
            setImmediate(next, new Error('The initialisation promise rejected'));
          }
        };

        setImmediate(save);
      } else {
        log('Document is not new; skipping.');
        setImmediate(next);
      }
    });
  }

  private addResetCount(): void {
    if (this.options.resetCount) {
      log('Adding %s instance and static methods for %s', this.options.resetCount, this.model);
      this.resetCountFn = this.resetCountFn.bind(this);

      this.schema.static(this.options.resetCount, this.resetCountFn);
      this.schema.method(this.options.resetCount, this.resetCountFn);
    } else {
      log('Skipping resetCount methods for %s', this.model);
    }
  }

  private init(): Promise<void> {
    log('Performing plugin initialisation');

    return IdCounter.findOne(this.findArgs, {_id: 1})
      .lean()
      .then((doc: any): void | Promise<void> => {
        if (!doc) {
          const payload: IdCounterModel = {
            c: this.initialStart,
            f: this.options.field,
            m: this.model
          };
          log('No counter document found for %s; creating with %s', this.model, JSON.stringify(payload));

          return IdCounter.create(payload)
            .then(() => {
              log('Counter document for %s created', this.model);
              this.ready = true;
            });
        } else {
          this.ready = true;
        }
      });
  }

  private nextCountFn(): Promise<number> {
    return (<Promise<IdCounterModel>>IdCounter.findOne(this.findArgs, {c: 1}).lean().exec())
      .then((doc: IdCounterModel): number => {
        return doc === null ? this.options.startAt : doc.c + this.options.incrementBy;
      });
  }

  private onSaveAnyField(): Promise<number> {
    return (<Promise<IdCounterModel>>IdCounter
      .findOneAndUpdate(
        this.findArgs,
        {$inc: {c: this.options.incrementBy}},
        {new: true, setDefaultsOnInsert: true, upsert: true, fields: {c: 1}}
      )
      .lean()
      .exec())
      .then((doc: IdCounterModel): number => doc.c);
  }

  private onSaveNumberField(value: number): Promise<any> {
    return IdCounter
      .findOneAndUpdate(
        {f: this.options.field, m: this.model, c: {$lt: value}},
        {c: value},
        {new: true, fields: {c: 1}}
      )
      .lean()
      .exec();
  }

  private resetCountFn(): Promise<number> {
    return IdCounter
      .findOneAndUpdate(
        this.findArgs,
        {c: this.initialStart},
        {new: true, upsert: true, fields: {_id: 1}}
      )
      .lean()
      .then((): number => this.options.startAt);
  }
}

import {Document, model, Model, Schema} from 'mongoose';

const enum Conf {
  RETRY_TIMEOUT = 5
}

interface IdCounter {
  field: string;
  model: string;
  num: number;
}

interface IdCounterDocument extends IdCounter, Document {}

const schema = new Schema(
  {
    field: {
      required: true,
      type: String
    },
    model: {
      required: true,
      type: String
    },
    num: {
      default: 0,
      required: true
    }
  },
  {
    autoIndex: true,
    id: false,
    skipVersioning: true,
    timestamps: false,
    versionKey: false,
  }
);

schema.index({field: 1, model: 1}, {unique: true});

let IdCounter: Model<IdCounterDocument>;

export type NextCountFunction = () => Promise<number>;
export type ResetCountFunction = () => Promise<number>;

export interface PluginOptions {
  field: string;
  incrementBy: number;
  nextCount: string;
  resetCount: string;
  startAt: number;
  unique: boolean;
}

export class MongooseAutoIncrementID {
  private static initialised = false;

  public static initialise(modelName = 'IdCounter'): void {
    if (MongooseAutoIncrementID.initialised) {
      throw new Error('Already initialised');
    }

    IdCounter = model<IdCounterDocument>(modelName, schema);
    MongooseAutoIncrementID.initialised = true;
  }

  public static plugin(schema: Schema, model: string, options: Partial<PluginOptions> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!MongooseAutoIncrementID.initialised) {
        return reject(new Error('The initialise method has not been called'));
      }

      const opts: PluginOptions = {
        field: '_id',
        incrementBy: 1,
        nextCount: '_nextCount',
        resetCount: '_resetCount',
        startAt: 1,
        unique: true
      };
      let ready = false;
      let rejected = false;

      try {
        Object.assign(opts, options);

        if (opts.field === '_id') {
          opts.unique = true;
        }

        const nextCount: NextCountFunction = (): Promise<number> => {
          return IdCounter.findOne({field: opts.field, model}, {num: 1})
            .lean()
            .then((counter: IdCounter): number => {
              return counter === null ? opts.startAt : counter.num + opts.incrementBy;
            });
        };

        schema.static(opts.nextCount, nextCount);
        schema.method(opts.nextCount, nextCount);

        const resetCount: ResetCountFunction = () => {
          return IdCounter
            .findOneAndUpdate(
              {field: opts.field, model},
              {num: opts.startAt - opts.incrementBy},
              {new: true, upsert: true, fields: {_id: 1}}
            )
            .lean()
            .then((): number => opts.startAt);
        };

        schema.static(opts.resetCount, resetCount);
        schema.method(opts.resetCount, resetCount);

        schema.pre('save', function (this: Document, next: any): void {
          const doc: Document = this;

          if (doc.isNew) {
            const save = () => {
              if (ready) {
                if (typeof this[opts.field] === 'number') {
                  IdCounter.findOneAndUpdate(
                    {field: opts.field, model, num: {$lt: doc[opts.field]}},
                    {num: doc[opts.field]},
                    {new: true, fields: {num: 1}}
                    )
                    .lean()
                    .then(() => {
                      next();
                    })
                    .catch(next);
                } else {
                  IdCounter.findOneAndUpdate(
                    {field: opts.field, model},
                    {$inc: {num: opts.incrementBy}},
                    {new: true, setDefaultsOnInsert: true, upsert: true, fields: {num: 1}}
                    )
                    .lean()
                    .then((updatedIdentityCounter: IdCounter): void => {
                      doc[opts.field] = updatedIdentityCounter.num;
                      next();
                    })
                    .catch(next);
                }
              } else if (!rejected) {
                setTimeout(save, Conf.RETRY_TIMEOUT);
              }
            };

            save();
          } else {
            setImmediate(next);
          }
        });

        IdCounter.findOne({field: opts.field, model})
          .lean()
          .then((counter: IdCounter) => {
            if (!counter) {
              const payload: IdCounter = {
                field: opts.field,
                model,
                num: opts.startAt - options.incrementBy
              };

              return IdCounter.create(payload)
                .then(() => {
                  ready = true;
                  resolve();
                });
            } else {
              ready = true;
              resolve();
            }
          })
          .catch((e: any) => {
            rejected = true;
            reject(e);
          });
      } catch (e: any) {
        rejected = true;
        reject(e);
      }
    });
  }
}
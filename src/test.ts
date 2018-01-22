// tslint:disable:no-unused-expression no-empty no-invalid-this no-duplicate-imports

import {expect} from 'chai';
import isEqual = require('lodash/isEqual');
import objectValues = require('lodash/values');
import * as mongoose from 'mongoose';
import {Document, Model} from 'mongoose';
import * as util from 'util';
import {v4} from 'uuid';
import {IdCounterDocument, MongooseAutoIncrementID, NextCountFunction, ResetCountFunction} from './index';

function inspect(value: any, opts: util.InspectOptions = {}): string {
  return util.inspect(value, Object.assign({colors: true}, opts));
}

(<any>mongoose).Promise = Promise;

const Schema = mongoose.Schema;

interface FooInterface {
  foo: number;
}

interface FooDocument extends FooInterface, Document, HasFunctions {
}

interface HasFunctions {
  _nextCount: NextCountFunction;
  _resetCount: NextCountFunction;
  nextID: NextCountFunction;
  resetID: ResetCountFunction;
}

describe('Core', () => {
  // let Foo: Model<FooDocument> & HasFunctions;
  // let sch: Schema;

  const modelMap = new Map<string | undefined, Model<IdCounterDocument>>();

  function getModel(): Model<IdCounterDocument> {
    return MongooseAutoIncrementID['idCounter'];
  }

  function cleanIdCount(): Promise<void> {
    return getModel().deleteMany({})
      .lean()
      .then(() => {
      });
  }

  function deinitialise() {
    MongooseAutoIncrementID['idCounter'] = <any>null;
  }

  function initialise(modelName?: string) {
    if (modelMap.has(modelName)) {
      MongooseAutoIncrementID['idCounter'] = <Model<IdCounterDocument>>modelMap.get(modelName);
    } else {
      deinitialise();
      MongooseAutoIncrementID.initialise(modelName);
      modelMap.set(modelName, MongooseAutoIncrementID['idCounter']);
    }
  }

  before('Connect', () => {
    const connectionOptions: any = {};

    if ((mongoose.version || '').charAt(0) === '4') {
      connectionOptions.useMongoClient = true;
    }

    return mongoose.connect('mongodb://127.0.0.1/auto-id-tests', connectionOptions);
  });

  before('Initialise', () => initialise());

  before('Remove id counters', () => cleanIdCount());
  after('Clean ID count', () => cleanIdCount());

  describe('Constructor', () => {
    it('Should throw if schema is missing', () => {
      expect(() => new MongooseAutoIncrementID(<any>null, 'x'))
        .to.throw(TypeError, 'Schema is required and must be an instance of Mongoose Schema');
    });
    it('Should throw if schema is not an instance of Schema', () => {
      expect(() => new MongooseAutoIncrementID(<any>true, 'x'))
        .to.throw(TypeError, 'Schema is required and must be an instance of Mongoose Schema');
    });
    it('Should throw if modelName is absent', () => {
      expect(() => new MongooseAutoIncrementID(new mongoose.Schema(), ''))
        .to.throw(TypeError, 'Model name must be a string');
    });
    it('Should throw if modelName is not a string', () => {
      expect(() => new MongooseAutoIncrementID(new mongoose.Schema(), <any>true))
        .to.throw(TypeError, 'Model name must be a string');
    });
    it('Should succeed if all is ok', () => {
      expect(() => new MongooseAutoIncrementID(new mongoose.Schema(), 'foo'))
        .not.to.throw();
    });
  });

  describe('initialise', () => {
    after('re-initialise', () => initialise());

    it('Should throw if already initialised', () => {
      deinitialise();
      expect(() => {
        MongooseAutoIncrementID.initialise();
        MongooseAutoIncrementID.initialise();
      })
        .to.throw(Error, 'Already initialised');
    });

    describe('Should throw if model name is', () => {
      beforeEach(() => deinitialise());

      it('Absent', () => {
        expect(() => MongooseAutoIncrementID.initialise(<any>null))
          .to.throw(TypeError, 'Model name is required');
      });
      it('Not a string', () => {
        expect(() => MongooseAutoIncrementID.initialise(<any>5))
          .to.throw(TypeError, 'Model name is required');
      });
    });

    it('Model name should default to IdCounter', () => {
      initialise();
      expect(getModel().modelName).to.eq('IdCounter');
    });

    it('Model name should be settable', () => {
      const id: string = v4();
      initialise(id);
      expect(getModel().modelName).to.eq(id);
    });
  });

  describe('Counter schema settings', () => {
    after(() => cleanIdCount());
    let doc: IdCounterDocument;

    before('Create sample doc', async() => {
      doc = await getModel().create({f: 'a', m: 'b'});
    });

    it('Should have an objectID _id', () => {
      expect(typeof doc._id).to.eq('object');
    });
    it('Should not have a virtual id', () => {
      expect(doc.id).to.be.undefined;
    });
    it('Should not have a version field', () => {
      expect(doc.__v).to.be.undefined;
    });
    it('Should not have a createdAt field', () => {
      expect(doc['createdAt']).to.be.undefined;
    });
    it('Should not have an updatedAt field', () => {
      expect(doc['updatedAt']).to.be.undefined;
    });

    it('Should have an index on f & m', async() => {
      const indices: any = objectValues(await getModel().collection.getIndexes());

      for (const index of indices) {
        if (isEqual(index, [['f', 1], ['m', 1]]) || isEqual(index, [['m', 1], ['f', 1]])) {
          return;
        }
      }

      console.log(inspect(indices));
      throw new Error('Index not found');
    });
  });

  describe('nextCount', () => {
    describe('Should be called _nextCount by default', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(typeof model._nextCount).to.eq('function');
      });
      it('On the instance', () => {
        expect(typeof new model()._nextCount).to.eq('function');
      });
    });
    describe('Should be undefined if false is passed', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {nextCount: false}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(model._nextCount).to.be.undefined;
      });
      it('On the instance', () => {
        expect(new model()._nextCount).to.be.undefined;
      });
    });

    describe('Should be renameable', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {nextCount: 'nextID'}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      describe('nextID should exist', () => {
        it('On the model', () => {
          expect(typeof model.nextID).to.eq('function');
        });
        it('On the instance', () => {
          expect(typeof new model().nextID).to.eq('function');
        });
      });

      describe('_nextCount should not exist', () => {
        it('On the model', () => {
          expect(model._nextCount).to.be.undefined;
        });
        it('On the instance', () => {
          expect(new model()._nextCount).to.be.undefined;
        });
      });
    });
  });

  describe('resetCount', () => {
    describe('Should be called _resetCount by default', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(typeof model._resetCount).to.eq('function');
      });
      it('On the instance', () => {
        expect(typeof new model()._resetCount).to.eq('function');
      });
    });
    describe('Should be undefined if false is passed', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {resetCount: false}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      it('On the model', () => {
        expect(model._resetCount).to.be.undefined;
      });
      it('On the instance', () => {
        expect(new model()._resetCount).to.be.undefined;
      });
    });

    describe('Should be renameable', () => {
      const name: string = v4();
      const sch = new Schema({foo: {type: Number, required: true}});
      let model: Model<FooDocument> & HasFunctions;

      before('plugin', () => {
        return new MongooseAutoIncrementID(sch, name, {resetCount: 'resetID'}).applyPlugin();
      });

      before('model', () => {
        model = <any>mongoose.model(name, sch);
      });

      describe('resetID should exist', () => {
        it('On the model', () => {
          expect(typeof model.resetID).to.eq('function');
        });
        it('On the instance', () => {
          expect(typeof new model().resetID).to.eq('function');
        });
      });

      describe('_resetCount should not exist', () => {
        it('On the model', () => {
          expect(model._resetCount).to.be.undefined;
        });
        it('On the instance', () => {
          expect(new model()._resetCount).to.be.undefined;
        });
      });
    });
  });

  // before('Init Schema', () => {
  //   sch = new Schema({
  //                      foo: {
  //                        type: Number
  //                      }
  //                    });
  // });
  //
  // before('Init plugin', () => {
  //   const ai = new MongooseAutoIncrementID(sch, 'Foo', {
  //     nextCount: 'nextID',
  //     resetCount: 'resetID'
  //   });
  //
  //   return ai.applyPlugin();
  // });
  //
  // before('Init model', () => {
  //   Foo = <Model<FooDocument> & HasFunctions>mongoose.model<FooDocument>('Foo', sch);
  // });

  // it('Model should have a nextID function', () => {
  //   expect(typeof Foo.nextID).to.eq('function');
  // });
  // it('Model should have a resetID function', () => {
  //   expect(typeof Foo.resetID).to.eq('function');
  // });
  // it('Instance should have a nextID function', () => {
  //   expect(typeof new Foo().nextID).to.eq('function');
  // });
  // it('Instance should have a resetID function', () => {
  //   expect(typeof new Foo().resetID).to.eq('function');
  // });
});

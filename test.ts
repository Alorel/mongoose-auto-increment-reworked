import {expect} from 'chai';
import * as mongoose from 'mongoose';
import {Document, Model, Schema} from 'mongoose';
import {inspect} from 'util';
import {v4} from 'uuid';
import {IdCounterDocument, MongooseAutoIncrementID, NextCountFunction, ResetCountFunction} from './index';
import isEqual = require('lodash/isEqual');
import objectValues = require('lodash/values');

inspect.defaultOptions = {colors: true};

(<any>mongoose).Promise = Promise;

interface FooInterface {
  foo: number;
}

interface FooDocument extends FooInterface, Document, HasFunctions {}

interface HasFunctions {
  _nextCount: NextCountFunction,
  _resetCount: NextCountFunction,
  nextID: NextCountFunction,
  resetID: ResetCountFunction;
}

describe('Core', () => {
  // let Foo: Model<FooDocument> & HasFunctions;
  // let sch: Schema;

  function getModel(): Model<IdCounterDocument> {
    return <Model<IdCounterDocument>>mongoose.model('IdCounter');
  }

  function cleanIdCount(): Promise<void> {
    return getModel().deleteMany({})
      .lean()
      .then(() => {
      });
  }

  before('Connect', function () {
    this.timeout(10000);
    return mongoose.connect('mongodb://127.0.0.1/auto-id-tests');
  });

  before('Initialise', () => MongooseAutoIncrementID.initialise());

  before('Remove id counters', () => cleanIdCount());
  after('Clean ID count', () => cleanIdCount());

  describe('Counter schema settings', () => {
    after(() => cleanIdCount());
    let doc: IdCounterDocument;

    before('Create sample doc', async () => {
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

    it('Should have an index on f & m', async () => {
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
        return new MongooseAutoIncrementID(sch, name).plugin();
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
        return new MongooseAutoIncrementID(sch, name, {nextCount: false}).plugin();
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
        return new MongooseAutoIncrementID(sch, name, {nextCount: 'nextID'}).plugin();
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
  //   return ai.plugin();
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

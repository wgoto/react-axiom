import isPlainObject  from 'lodash/isPlainObject';
import mapValues      from 'lodash/mapValues';
import pick           from 'lodash/pick';
import Model          from './Model';


export default class Store extends Model {

  //==================
  // CLASS PROPERTIES
  //==================

  static models = [];
  static modelsHash = {};


  //===============
  // CLASS METHODS
  //===============

  static setModelRefs(models) {
    Store.models = models;
    Store.modelsHash = models.reduce((hash, model) => {
      hash[model.name] = model;
      return hash;
    }, {});
  }

  static defaultState() {
    return {
      entityDefinitions: {}
    };
  }


  //=====================
  // INTERFACING METHODS
  //=====================

  stringify(...keys) {
    const models = this._createModelsHash();
    const _state = keys.length ? pick(this.state, keys) : this.state;
    const state = this._toSerialState(_state, models);
    return JSON.stringify({ state, models });
  }

  parse(json) {
    const { state, models } = JSON.parse(json);
    const newModels = this._createModelsHash();
    this.state = this._fromSerialState(state, models, newModels);
  }

  parseMerge(json) {
    const { state, models } = JSON.parse(json);
    const newModels = this._createModelsHash();
    Object.assign(this.state, this._fromSerialState(state, models, newModels));
  }

  addEntities(entities) {
    this.setState(this._mergeEntities(entities));
  }


  //==================
  // INTERNAL METHODS
  //==================

  _createModelsHash() {
    return mapValues(Store.modelsHash, () => {
      return {};
    });
  }

  _toSerial(data, store) {
    if (data instanceof Model) {
      return this._toSerialModel(data, store);
    }

    if (isPlainObject(data)) {
      return this._toSerialState(data, store);
    }

    if (data instanceof Array) {
      return data.map(datum => this._toSerial(datum, store));
    }

    return data;
  }

  _toSerialState(state, store) {
    return mapValues(state, (value, key) =>
      this._toSerial(state[key], store)
    );
  }

  _toSerialModel(model, store) {
    const { _id, constructor, state } = model;
    const _constructor = constructor.name;

    if (!store[_constructor][_id]) {
      store[_constructor][_id] = this._toSerialState(state, store);
    }

    return { _constructor, _id };
  }

  _fromSerial(data, models, newModels) {
    if (isPlainObject(data)) {
      if (data._constructor) {
        return this._fromSerialModel(data, models, newModels);
      }

      return this._fromSerialState(data, models, newModels);
    }

    if (data instanceof Array) {
      return data.map(datum => this._fromSerial(datum, models, newModels));
    }

    return data;
  }

  _fromSerialState(state, models, newModels) {
    return mapValues(state, (value, key) =>
      this._fromSerial(value, models, newModels)
    );
  }

  _fromSerialModel(model, models, newModels) {
    const { _id, _constructor } = model;
    const newModelHash = newModels[_constructor];

    if (newModelHash[_id]) {
      return newModelHash[_id];
    }

    const newModel = new Store.modelsHash[_constructor](
      this._fromSerial(models[_constructor][_id], models, newModels)
    );

    return newModelHash[_id] = newModel;
  }

  _mergeEntities(entities) {
    return mapValues(entities, (entity, key) =>
      this._mergeEntity(entity, key)
    );
  }

  _mergeEntity(entity, key) {
    return Object.assign({}, this.state[key], this._mergeInstances(entity, key));
  }

  _mergeInstances(entity, key) {
    return mapValues(entity, (instance, id) =>
      this._instanceExists(key, id)
        ? this._updateExistingInstance(key, id, instance)
        : this._createNewInstance(key, instance)
    );
  }

  _instanceExists(key, id) {
    return !!this.state[key][id];
  }

  _updateExistingInstance(key, id, instance) {
    this.state[key][id].setState(instance);
    return this.state[key][id];
  }

  _createNewInstance(key, instance) {
    const Model = this.getEntityDefinitions()[key];
    return new Model(Object.assign({}, instance, { store: this }));
  }

}

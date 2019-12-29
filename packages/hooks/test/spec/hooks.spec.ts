import Hooks from './../../src';

describe('Hooks', () => {
  let hooks: Hooks;
  it('should properly be constructed', async () => {
    hooks = new Hooks();
    expect(hooks instanceof Hooks).toBeTruthy();
  });
  // describe('should properly cast an `objectId` bsonType', () => {
  //   it('from a `string`', async () => {
  //     const {ops, insertedId} = await TestModel.insertOne({
  //       objectIdValue: '5bcdc07ffd331bc20d10f2d7'
  //     });
  //     // Check op result
  //     const insertedDoc = ops[0];
  //     expect(ObjectId.isValid(insertedDoc.objectIdValue)).toBeTruthy();
  //     expect(insertedDoc.objectIdValue.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
  //     // Check findOne result
  //     const foundDoc = await TestModel.findOne({_id: insertedId});
  //     expect(ObjectId.isValid(foundDoc.objectIdValue)).toBeTruthy();
  //     expect(foundDoc.objectIdValue.toString()).toEqual('5bcdc07ffd331bc20d10f2d7');
  //   });
  // });
});

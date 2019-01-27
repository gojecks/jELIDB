/**
 * @param {*} name
 * @param {*} mode 
 */
DBEvent.prototype.table = function(name, mode) {
    var defer = new _Promise();
    //get the requested table
    if (name && $queryDB.$getActiveDB(this.name).$get('$tableExist')(name)) {
        defer.resolve({ result: new jEliDBTBL($queryDB.$getTable(this.name, name), mode) });
    } else {
        defer.reject({ message: "There was an error, Table (" + name + ") was not found on this DB (" + this.name + ")", errorCode: 401 })
    }

    return new DBPromise(defer);
};
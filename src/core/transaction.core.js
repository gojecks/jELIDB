//@Function Name {jTblQuery}
//@argument {object}
// @return Object

function jTblQuery(tableInfo, mode, isMultipleTable, tables) {

    var select = "",
        tblMode = mode || 'read',
        _recordResolvers = $queryDB.$getActiveDB(tableInfo.DB_NAME).$get('recordResolvers');

    this.executeState = [];
    this.tableInfo = tableInfo;
    this.tables = tables;
    this.errLog = [];
    this.isMultipleTable = isMultipleTable;

    this.getError = function() {
        return this.errLog;
    };

    this.setDBError = function(msg) {
        if (!expect(this.errLog).contains(msg)) {
            this.errLog.push(msg);
        }
    };

    this.hasError = function() {
        return this.errLog.length;
    };

    this.getAllRef = function(data) {
        return [].map.call(data || this.tableInfo.data, function(item) {
            return item._ref;
        });
    };

    //Check if Table Information is available from the DB
    if (!$isObject(tableInfo)) {
        errorBuilder('Unable to perform query at the moment, please try again later');
    }

    //Check the required Mode
    if (expect(tblMode).contains('write') && !this.isMultipleTable) {
        this.insert = transactionInsert;
        this.update = transactionUpdate;

        //@Function lastInsertId
        //@parameter null
        //@return INTERGER

        this.lastInsertId = function() {
            return tableInfo.lastInsertId;
        };

        this['delete'] = transactionDelete;
    }

    if (expect(tblMode).contains('read')) {
        if (isMultipleTable) {
            //Query Logic Object
            //Where and SortBy Logics
            this.condition = new $query(tableInfo.data);
        }


        this.select = transactionSelect;
        this.getColumn = transactionSelectColumn;

        /**
         * Quick Search Language
         */
        this.qsl = new generateQuickSearchApi(this);

    }

    /**
      update offline cache
    **/
    this.updateOfflineCache = function(type, data) {
        if (!expect($queryDB.getNetworkResolver('ignoreSync', tableInfo.DB_NAME)).contains(tableInfo.TBL_NAME) && data.length) {
            _recordResolvers
                .$set(tableInfo.TBL_NAME)
                .data(type, data);
        }
    };


    function generateQuickSearchApi(_super) {
        var self = this;
        if (!_super.isMultipleTable) {
            expect(_super.tableInfo.columns[0]).each(function(column, columnName) {
                self['findby' + columnName] = buildQuery(columnName);
            });
        } else {
            self.findByColumn = buildQuery;
        }


        function buildQuery(columnName) {
            return function(value, table) {
                if (_super.isMultipleTable && !table) {
                    errorBuilder('Current state is having multiple table, please specify the table');
                }

                return _super.select('*', {
                        where: columnName + "==" + value
                    })
                    .execute();

            }
        }
    }
}


jTblQuery.prototype.execute = function(disableOfflineCache) {
    if (this.executeState.length) {
        var defer = new $p(),
            error = !1,
            $self = this,
            executeLen = this.executeState.length;

        while (executeLen--) {
            var ex = this.executeState.pop();
            if (ex.length > 1) {
                var ret = { state: ex[0] };
                try {
                    var res = ex[1].call(ex[1], disableOfflineCache);
                    sqlResultExtender(ret, res);
                } catch (e) {
                    ret.message = e.message;
                    error = true;
                } finally {
                    $self.errLog = [];
                    if (expect(["insert", "update", "delete"]).contains(ex[0]) && !error) {
                        /**
                         * Sync to the backend
                         * Available only when live is define in configuration
                         * @param {TABLE_NAME}
                         * @param {DB_NAME}
                         * @return {FUNCTION}
                         */
                        liveProcessor($self.tableInfo.TBL_NAME, $self.tableInfo.DB_NAME)(ex[0], function(res) {
                            ret.$ajax = extend({}, res.data);
                            defer['resolve'](ret);
                        }, function() {
                            defer['reject'](ret);
                        });

                        jEliUpdateStorage($self.tableInfo.DB_NAME, $self.tableInfo.TBL_NAME);
                    } else {
                        defer[!error ? 'resolve' : 'reject'](ret);
                    }
                }
            }
        };


        return new DBPromise(defer);
    }
};
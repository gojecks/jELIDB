/*

	indexedDB Support 
	For jEliDB

*/

function indexedDBStorage(CB){
	
	var publicApis = {},
		dbName = "_jEliDB_",
		_storeName = '_jEli_DB_Store_',
		_version = 1,
		_db,
		_dataHolder = {};

	// open the DB
	function createDB(version, onUpgradeneeded){
		// set the reference to our latest version
		_version = version || _version;
		var req = $isSupport.indexedDB.open(dbName, _version);

		req.onsuccess = function(evt){
			_db = this.result;

			getAllStoreData()
			.then((CB || noop))
		};

		req.onerror = function (evt) {
	      console.error("jEliDB:indexedDB:Error:", evt.target.errorCode);
	    };

	    req.onupgradeneeded = onUpgradeneeded || noop;
	}


	// create our DB with the default version
	createDB(1, function(ev){
	  	var db = ev.target.result;
		  // Create an objectStore to hold information . We're
		  // going to use "ssn" as our key path because it's guaranteed to be
		  // unique - or at least that's what I was told during the kickoff meeting.
		 db.createObjectStore(_storeName, { keyPath : "_rev" });
	});


	function getAllStoreData(){
		var store = getObjectStore(_storeName, "readwrite"),
			req = store.openCursor(),
			$defer = new $p();

    	req.onsuccess = function(evt) {
      			var cursor = evt.target.result;
		      // If the cursor is pointing at something, ask for the data
		      if (cursor) {
		      	// get our data and append to our local store for quick query
		        req = store.get(cursor.key);
		        req.onsuccess = function (evt) {
		          var value = evt.target.result;
		          _dataHolder[cursor.key] = value._data;
		        };

		        // Move on to the next object in store
		        cursor.continue();

		      } else {
		        $defer.resolve();
		      }
    	};

    	return $defer;
	}
	


    function indexedDbPrivateApi(){

    	this.checkStoreName = function(storeName){
    		return _db.objectStoreNames.contains(storeName);
    	};

    	this.addStore = function(storeName,  data){
    		if(this.checkStoreName(_storeName)){

			    // Use transaction oncomplete to make sure the objectStore creation is 
				// finished before adding data into it.
				var store = getObjectStore(_storeName, "readwrite");
					// Store values in the newly created objectStore.
				    store.put({
				    	_rev:storeName,
				    	_data:data
				    });
				// update cache
				_dataHolder[storeName] = data;
    		}
		    
    		return this;
    	};

    	this.clearStore = function(storeName, CB){
    		var store = getObjectStore(storeName, 'readwrite');
    		var req = store.clear();

    		req.onsuccess = CB || noop;
    	};

    	this.getStoreItem = function(rev, CB){
    		var store = getObjectStore(_storeName, 'readonly'),
    			req = store.get(rev),
    			ret;
    		req.onsuccess = CB(req);
    	};
    }


  /**
   * @param {string} store_name
   * @param {string} mode either "readonly" or "readwrite"
   */

  function getObjectStore(store_name, mode) {
    var tx = _db.transaction(store_name, mode);
    return tx.objectStore(store_name);
  }

  	var _pApis = new indexedDbPrivateApi();
  	publicApis.setItem = function(name,item){
	  _pApis.addStore(name, item );
	};

	publicApis.getItem = function(name){
		return _dataHolder[name];
	};

	publicApis.removeItem = function(name){
	  _pApis.clearStore(name, function(){
	  	delete _dataHolder[name];
	  });
	};

	 publicApis.usage = function(name){
      return JSON.stringify(this.getItem(name) || '').length;
    };


	return publicApis;

}
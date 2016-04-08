// jshint jquery: true, browser: true, devel: true
//
DDH.calculator = DDH.calculator || {};

/* global DDG, Goodie, isNumber */
DDH.calculator.build = function() {
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    function wrapActiveHTML(html) {
        return "<span class='active-field'>" + html + "</span>";
    }
    var Utils = {
        cancelEvent: function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    };

    /**
     * Keycodes of keys
     * @type {Object}
     */
    var K = {
        BACKSPACE: 8,
        ENTER: 13,
        ESC: 27,
        SPACE: 32,
        RIGHT_ARROW: 39,
        LEFT_ARROW: 37
    };

    /**
     * Key aliases to commands
     * @type {Object}
     */
    var KEY_ALIASES = {
        '%': 'OP_PCT',
        '*': 'OP_MULT',
        '/': 'OP_DIV',
        '÷': 'OP_DIV',
        '+': 'OP_PLUS',
        '-': 'OP_MINUS',
        '^': 'FN_POW_N',
        '(': 'PAR_OPEN',
        ')': 'PAR_CLOSE',
        '=': 'META_PROCEED',
        'E': 'FN_EE'
    };

    // Traversable fields for the display.
    function CalcField(options) {
        this.rep = options.rep;
        this.numFields = options.numFields || 0;
        // this.fields = [newEmptyCollector()];
        this._fields = options.fields || Array.apply(null, Array(this.numFields)).map(function() {
            return newEmptyCollector();
        });
        // this._fields = options.fields || Array(this.numFields).map(function() {
        //     return newEmptyCollector();
        // });
        this.actionType = options.actionType || 'NONE';
        this.name = options.name || this.rep;
        this.htmlRep = options.htmlRep || this.rep;
    }

    CalcField.prototype.toString = function() {
        return 'CF:{' + this.actionType + ', ' + this.name + ', ' + this.numFields + '}';
    };

    CalcField.prototype.asText = function() {
        if (typeof this.rep === 'string') {
            return this.rep;
        }
        if (typeof this.rep === 'function') {
            return this.rep();
        }
        console.warn('[CF.asText] did not generate any text!');
    };

    // Produces HTML output for representing the field.
    CalcField.prototype.toHtml = function(activeField) {
        if (typeof this.htmlRep === 'string') {
            if (activeField !== undefined) {
                return wrapActiveHTML(this.htmlRep);
            }
            return this.htmlRep;
        }
        if (typeof this.htmlRep === 'function') {
            return this.htmlRep(activeField);
        }
        console.warn('[CF.toHtml] did not generate any html!');
    };

    // Retrieve the Field accessed through pos.
    CalcField.prototype.accessField = function(pos) {
        var thisFieldToAccess = pos.topLevel();
        if (thisFieldToAccess >= this.numFields) {
            console.warn("[CF.accessField] field access is greater than num fields!: " + this.numFields + ", " + thisFieldToAccess);
            return;
        }
        if (pos.atTopLevel()) {
            return this._fields[thisFieldToAccess];
        }
        if (pos._pos.length === 0) {
            console.error("[CF.accessField] attempt to access with zero-length");
            return;
        }
        return this._fields[thisFieldToAccess].accessField(pos.childLevel());
    };

    CalcField.prototype.setField = function(pos, val) {
      var thisFieldToAccess = pos.topLevel();
      if (thisFieldToAccess >= this.numFields) {
          console.warn("[CF.setField] field access is greater than num fields!: " + this.numFields + ", " + thisFieldToAccess);
      } else {
          if (pos.atTopLevel()) {
            this._fields[thisFieldToAccess] = val;
          }
          var newPos = pos.childLevel();
          return this._fields[thisFieldToAccess].setField(newPos, val);
      }
    };

    // Append 'value' after position 'pos'.
    CalcField.prototype.appendFieldAfter = function(pos, value) {
        if (this.numFields <= (pos.topLevel())) {
            console.warn("[CF.appendFieldAfter] position too great: " + pos);
            return;
        }
        this._fields[pos.topLevel()].appendFieldAfter(pos.childLevel(), value);
        return value;
    };

    CalcField.prototype.deleteField = function(pos) {
        if (pos.atTopLevel()) {
            console.error('[CF.deleteField] attempt to delete unprotected field!');
            return;
        }
        return this._fields[pos.topLevel()].deleteField(pos.childLevel());
    };

    function CalcNonDisplay(options) {
        this.actionType = options.actionType;
        this.runAction = options.runAction;
    }


    function calcFieldChar(n) {
        return new CalcField({
            numFields: 0,
            actionType: 'CHAR',
            rep: n
        });
    }

    function calcFieldPlaceHolder() {
        return new CalcField({
            actionType: 'PLACE_HOLDER',
            rep: 'P',
            htmlRep: 'P',
            runAction: function() { console.error('Place holder called!'); }
        });
    }


    // A field collector is used to group fields together under a single
    // position - for example, in function arguments.
    function FieldCollector(options) {
        this.actionType = 'COLLECT';
        this.allow = options.allow;
        this._fields = options.fields || [];
        this.rep = function() {
            var arrRep = this._fields.map(function (element) {
                var asText = element.asText();
                return asText;
                // return element.asText();
            });
            return arrRep.join('');
        };
    }

    FieldCollector.prototype.asText = function() {
        return this._fields.map(function(field) { return field.asText(); }).join('');
    };

    FieldCollector.prototype.toString = function() {
        var str = 'FC[' + this._fields.join(', ') + ']';
        return str;
        // return 'FC:' + this._fields;
    };

    FieldCollector.prototype.toHtml = function(activeField) {
        var activeChild;
        var activeIndex;
        var atTopLevel;
        if (activeField !== undefined) {
            activeIndex = activeField.topLevel();
            activeChild = activeField.childLevel();
            atTopLevel = activeField.atTopLevel();
        }
        var html = this._fields.map(function(field, index) {
            // console.error('[FC.toHtml] getting html for field: ' + field);
            if (atTopLevel && index === activeIndex) {
                return wrapActiveHTML(field.toHtml());
            }
            if (activeIndex !== undefined && index === activeIndex) {
                return field.toHtml(activeChild);
            }
            return field.toHtml();
        }).join('');
        return '<span>' + html + '</span>';
    };

    FieldCollector.prototype.setField = function(pos, val) {
        var thisFieldToAccess = pos.topLevel();
        if (pos.atTopLevel()) {
            this._fields[thisFieldToAccess] = val;
        } else {
            var newPos = pos.childLevel();
            return this._fields[thisFieldToAccess].setField(newPos, val);
        }
    };

    // Retrieve the Field accessed through pos.
    FieldCollector.prototype.accessField = function(pos) {
        var thisFieldToAccess = pos.topLevel();
        if (thisFieldToAccess >= this._fields.length) {
            console.warn("[FC.accessField] Attempt to access a field not yet defined! (" + thisFieldToAccess + ')');
            return;
        }
        if (pos._pos.length === 0) {
            console.error("[FC.accessField] Attempt to access a Collector!");
            return;
        }
        if (pos.atTopLevel()) {
            return this._fields[thisFieldToAccess];
        }
        var restToAccess = pos.childLevel();
        return this._fields[thisFieldToAccess].accessField(restToAccess);
    };

    // Append 'value' after the field at 'pos'.
    FieldCollector.prototype.appendFieldAfter = function(pos, value) {
        var topLevel = pos.topLevel();
        if (pos.atTopLevel()) {
            this._fields.splice(topLevel + 1, 1, value);
            return value;
        }
        if (pos._pos.length === 0) {
            console.error('[FC.appendFieldAfter] got empty position!');
            return;
        }
        return this._fields[topLevel].appendFieldAfter(pos.childLevel(), value);
    };

    FieldCollector.prototype.deleteField = function(pos) {
        if (pos.atTopLevel()) {
            var deleted;
            if (this._fields.length === 1) {
                deleted = this._fields.splice(0, 1, calcFieldPlaceHolder())[0];
                return deleted;
                // return this._fields.splice(0, 1, calcFieldPlaceHolder())[0];
            }
            deleted = this._fields.splice(pos.topLevel(), 1)[0];
            return deleted;
            // return this._fields.splice(pos.topLevel(), 1)[0];
        }
        return this._fields[pos.topLevel()].deleteField(pos.childLevel());
    };

    // Collector with no fields.
    function newEmptyCollector() {
        return new FieldCollector({ fields: [calcFieldPlaceHolder()]});
    }

    // The 'zero' field collector for the default display.
    function newZeroFieldCollector() {
        return new FieldCollector({
            fields: [BTS['0']]
        });
    }

    function calcFieldOperator(symbol) {
        return new CalcField({
            rep: symbol,
            htmlRep: ' ' + symbol + ' ',
            numFields: 0
        });
    }

    function isPlaceHolder(field) {
        return field.actionType === 'PLACE_HOLDER';
    }

    function isCollector(field) {
        return field.actionType === 'COLLECT';
    }

    function canEnter(field) {
        return field.numFields !== 0;
    }

    function calcMeta(action) {
        return new CalcNonDisplay({
            actionType: 'META',
            runAction: action
        });
    }

    function calcFieldUnaryFn(name) {
        return function() {
            return new CalcField({
                actionType: 'FN',
                numFields: 1,
                rep: function() {
                    var rep = name + '(' + this._fields[0].asText() + ')';
                    return rep;
                },
                htmlRep: function(activeField) {
                    var activeChild;
                    if (activeField !== undefined) {
                        activeChild = activeField.childLevel();
                    }
                    return name + '(<span class="calc-field">' + this._fields[0].toHtml(activeChild) + '</span>)';
                }
            });
        };
    }


    // Buttons
    var BTS = {
        'OP_DIV': calcFieldOperator('÷'),
        'OP_MULT': calcFieldOperator('×'),
        'OP_PLUS': calcFieldOperator('+'),
        'OP_MINUS': calcFieldOperator('-'),
        'CONST_PI': calcFieldChar('π'),
        'FN_SIN': calcFieldUnaryFn('sin'),
        'FN_COS': calcFieldUnaryFn('cos'),
        'FN_TAN': calcFieldUnaryFn('tan'),
        'FN_FACT': calcFieldChar('!'),
        '0': calcFieldChar('0'),
        '1': calcFieldChar('1'),
        '2': calcFieldChar('2'),
        '3': calcFieldChar('3'),
        '4': calcFieldChar('4'),
        '5': calcFieldChar('5'),
        '6': calcFieldChar('6'),
        '7': calcFieldChar('7'),
        '8': calcFieldChar('8'),
        '9': calcFieldChar('9'),
        ' ': calcFieldChar(' '),
        '.': calcFieldChar('.'),
        'PAR_OPEN': calcFieldChar('('),
        'PAR_CLOSE': calcFieldChar(')'),
        'META_CLEAR': calcMeta(function () { calc.process.backspace(); }),
        'META_PROCEED': calcMeta(function () { calc.formula.calculate(); }),
        // 'META_PAR_OPEN': calcMeta(function () { calc.formula.levelUp(); }),
        // 'META_PAR_CLOSE': calcMeta(function () { calc.formula.levelDown(); }),
        'PLACE_HOLDER': new CalcNonDisplay({
            actionType: 'PLACE_HOLDER',
            runAction: function() { log.error('Place holder called!'); }
        }),
        'COLLECTOR': new FieldCollector({
            allow: function(toTest) {
                return (toTest.actionType === 'CHAR');
            }
        })
    };

    // Tracking display position.
    function DisplayPos(initialPos) {
        this._pos = initialPos || [];
    }

    DisplayPos.prototype.incrementLast = function(amount) {
        amount = amount || 1;
        this._pos[this._pos.length - 1] += amount;
    };

    // Is the position at the top level?
    DisplayPos.prototype.atTopLevel = function() {
        return this._pos.length === 1;
    };

    DisplayPos.prototype.atStart = function() {
        return this.atTopLevel() && this._pos[0] === 0;
    };

    DisplayPos.prototype.toString = function() {
        return "P[" + this._pos.join(', ') + ']';
    };

    DisplayPos.prototype.childLevel = function() {
        var newL = new DisplayPos(this._pos.slice(1));
        return newL;
    };

    // All but the very last position.
    DisplayPos.prototype.outerLevel = function() {
        var newL = new DisplayPos(this._pos.slice(0,-1));
        return newL;
    };

    DisplayPos.prototype.topLevel = function() {
        return this._pos[0];
    };

    // Decrease the last position in the cursor by 'amount', regardless
    // of whether or not the new position is valid.
    DisplayPos.prototype.decrementLast = function(amount) {
        amount = amount || 1;
        this._pos[this._pos.length - 1] -= amount;
    };

    // Move the position to a lower level.
    DisplayPos.prototype.increaseDepth = function() {
        this._pos.push(0);
    };

    // Move the position to a higher level.
    DisplayPos.prototype.decreaseDepth = function() {
        this._pos.pop();
    };

    DisplayPos.prototype.canMoveBackSameLevel = function() {
        return (this._pos.slice(-1)[0] !== 0);
    };

    DisplayPos.prototype.copy = function() {
        return new DisplayPos(this._pos.concat());
    };

    /**
     * Formula
     * Handles presentation & calculation
     * @param {String?} initialFormStr Formula string
     */
    function Formula(initialFormStr) {
        // this.storage = [''];
        this.storage = newZeroFieldCollector();
        this.cursor = new DisplayPos([0]);
        // this._cursor = new DisplayPos([0]);
        this.isCalculated = false;
        this.initialDisplay = true;

        if (initialFormStr !== undefined) {
            this.handleString(''+initialFormStr);
        } else {
            this.handleString('0');
        }
    }

    // Formula.prototype = {
    //     get cursor() {
    //         return this._cursor;
    //     }
    // };

    ///////////////
    /// STORAGE:
    /// Read
    ///////////////

    /**
     * Get field's value
     * @param  {Array} pos  Position index
     * @return {String|Array} Field's value
     */
    Formula.prototype.getField = function(pos) {
        return this.storage.accessField(pos);
    };


    /**
     * Get the value of the cursor's field
     * @return {String} value
     */
    Formula.prototype.getActiveField = function() {
        return this.getField(this.cursor);
    };

    Formula.prototype.getNextFieldSameLevel = function() {
        var cursorCopy = this.cursor.copy();
        cursorCopy.incrementLast();
        return this.getField(cursorCopy);
    };
    Formula.prototype.getPrevfieldSameLevel = function() {
        var cursorCopy = this.cursor.copy();
        cursorCopy.decrementLast();
        return this.getField(cursorCopy);
    };

    /////////////////////////
    //  Display Traversal  //
    /////////////////////////

    Formula.prototype.traverseForward = function() {
        var nextFieldSameLevel = this.getNextFieldSameLevel();
        if (nextFieldSameLevel === undefined) {
            if (this.cursor.atTopLevel()) {
                console.error("[F.traverseForward] at end of top level");
            } else {
                this.moveCursorIntoOuterCollector();
            }
        } else if (canEnter(nextFieldSameLevel)) {
            this.moveCursorForward();
            this.enterCurrentField();
        } else {
            this.moveCursorForward();
        }

    };
    // Check this for... Oddities.
    // Probably not compatible with arrow movement yet.
    Formula.prototype.traverseBackward = function() {
        var prevFieldSameLevel = this.getPrevfieldSameLevel();
        if (prevFieldSameLevel === undefined) {
            if (this.cursor.atTopLevel()) {
                console.error("[F.traverseBackward] at start of top level");
            } else {
                this.moveCursorIntoOuterCollector();
            }
        } else if (canEnter(prevFieldSameLevel)) {
            this.moveCursorBackward();
        } else {
            this.moveCursorBackward();
        }

    };
    // Move the cursor forward by amount (default 1)
    Formula.prototype.moveCursorForward = function(amount) {
        amount = amount || 1;
        this.cursor.incrementLast(amount);
        return this.cursor;
    };

    // Move the cursor backwards by amount (default 1)
    Formula.prototype.moveCursorBackward = function(amount) {
        amount = amount || 1;
        if (this.cursor.atStart()) {
            console.warn("[F.moveCursorBackward] attempt to move cursor backward when at start");
            return this.cursor;
        }
        this.moveCursorBackOrUp();
        return this.cursor;
    };

    Formula.prototype.moveCursorUpward = function() {
        this.cursor.decreaseDepth();
        return this.cursor;
    };

    // Is there room for the cursor to move backwards on the same level?
    Formula.prototype.canMoveBackSameLevel = function() {
        return this.cursor.canMoveBackSameLevel();
    };

    Formula.prototype.canMoveDown = function() {
        var current = this.getActiveField();
        return current.actionType === 'COLLECT' || current.numFields > 0;
    };


    // Attempt to move the cursor backwards, but move if up if there is
    // no room.
    Formula.prototype.moveCursorBackOrUp = function(amount) {
        if (this.cursor.atTopLevel()) {
            if (!this.canMoveBackSameLevel()) {
                console.warn("[moveCursorBackOrUp] already at start!");
                return this.cursor;
            }
            this.cursor.decrementLast(amount);
            return this.cursor;
        }
        if (this.canMoveBackSameLevel()) {
            this.cursor.decrementLast(amount);
        } else {
            this.moveCursorIntoOuterCollector();
            // this.moveCursorUpward();
        }
        return this.cursor;
    };

    // Increase the cursor depth, if possible.
    Formula.prototype.moveCursorDown = function() {
        if (this.canMoveDown()) {
            this.cursor.increaseDepth();
            return this.cursor;
        }
        return this.cursor;
    };

    Formula.prototype.tryEnterFn = function() {
        if (canEnter(this.getActiveField())) {
            this.enterCurrentField();
        }
    };

    Formula.prototype.enterCurrentField = function() {
        // Into Field
        this.moveCursorDown();
        // Into Collector
        this.moveCursorDown();
    };

    Formula.prototype.moveCursorIntoOuterCollector = function() {
        if (this.cursor.atTopLevel()) {
            console.error('[F.moveCursorIntoOuterCollector] attempt to use at top level!');
            return;
        }
        this.exitCurrentCollector();
        if (this.cursor.atTopLevel()) {
            return;
        }
        while (!isCollector(this.getField(this.cursor.outerLevel()))) {
            if (this.cursor.atTopLevel()) {
                console.warn('[F.moveCursorIntoOuterCollector] now in top level!');
                return;
            }
            this.cursor.decreaseDepth();
        }
    };

    Formula.prototype.exitCurrentCollector = function() {
        if (this.cursor.atTopLevel()) {
            console.error('[F.exitCurrentCollector] cannot exit from top level!');
            return;
        }
        if (isCollector(this.getActiveField())) {
            this.cursor.decreaseDepth();
            return;
        }
        this.cursor.decreaseDepth();
        this.exitCurrentCollector();
    };


    ////////////////////////
    //  Modifying Fields  //
    ////////////////////////

    // Modify the field at 'pos' (default cursor) to value.
    Formula.prototype.modifyCurrentField = function(value) {
        this.storage.setField(this.cursor, value);
    };

    // Append a new fragment with value 'val' after the cursor.
    Formula.prototype.appendFragmentChild = function(val) {
        this.storage.appendFieldAfter(this.cursor, val);
        // this.moveCursorForward();
        // this.tryEnterFn();
    };

    /**
     * Add new fragment to formula storage
     * @param  {Mixed}  val Value of new fragment could be String or Array
     * @param  {Array?} pos Target position on storage array - by default move to next fragment
     */
    Formula.prototype.addNewField = function(val) {
        if (this.initialDisplay || isPlaceHolder(this.getActiveField())) {
            this.modifyCurrentField(val);
            this.initialDisplay = false;
            this.tryEnterFn();
        } else {
            this.appendFragmentChild(val);
            this.traverseForward();
        }
    };

    Formula.prototype.deleteCurrentField = function() {
        var deleted;
        if (this.cursor.atStart()) {
            deleted = this.getActiveField();
            this.modifyCurrentField(BTS['0']);
            this.initialDisplay = true;
            this.render();
            return deleted;
        }
        deleted = this.storage.deleteField(this.cursor);
        if (isPlaceHolder(deleted)) {
            this.moveCursorIntoOuterCollector();
            this.deleteCurrentField();
        }
        this.render();
        return deleted;
        // return this.storage.deleteField(this.cursor);
    };

    Formula.prototype.deleteBackwards = function() {
        var pos = this.cursor;
        var deleted;
        if (this.cursor.atTopLevel()) {
            deleted = this.deleteCurrentField();
            this.traverseBackward();
            // this.moveCursorBackward();
            return deleted;
        }
        deleted = this.deleteCurrentField();
        this.traverseBackward();
    };


    //////////////////////
    //  Handling Input  //
    //////////////////////

    Formula.prototype.handleString = function(str) {
        console.warn('[F.handleString] str: ' + str);
        var _str = '' + str;
        for (var i = 0; i < _str.length; ++i) {
            this.handleChr(BTS[_str[i]], true);
        }
    };

    Formula.prototype.handleChr = function(chr, skipRender) {
        if (chr === undefined) {
            console.warn('[F.handleChr] got an undefined character!');
            return;
        }
        this.addNewField(chr);

        if (!skipRender) {
            this.render();
        }
    };

    Formula.prototype.handleCmd = function(cmd, skipRender) {
        this.addNewField(cmd);

        if (!skipRender) {
            this.render();
        }
    };

    Formula.prototype.handleBackspace = function() {
        if (this.isCalculated) {
            this.reset();
            return;
        }

        this.deleteBackwards();
        this.render();
    };

    Formula.prototype.toText = function() {
        return this.storage.asText();
    };

    Formula.prototype.calculateResult = function(_arr, _path) {
        var query = this.toText();
        if (query === '0') {
            return;
        }
        // Use the below link in production
        // $.getJSON("https://crossorigin.me/" + "https://beta.duckduckgo.com/?format=json&q=" + encodeURIComponent(query), function(data) {
        $.getJSON("http://localhost:5000/?format=json&q=" + encodeURIComponent(query), function(data) {
            calc.history.add(data.Answer.data);
        });
    };

    Formula.prototype.calculate = function() {
        this.isCalculated = true;
        var html = this.toHtml();
        this.calculateResult();
        var result = $("#zci__calculator-display-main").text();
        calc._cache.$formulaMinor.html(html);

        // Prepare for next calculation
        calc.formula.reset();

        // Shhhh... ;)
        if (result === '42') {
            calc._cache.$inputField
                .prepend(
                    '<span class="tile__calc__eg">' +
                    "DON'T PANIC" +
                    '</span>'
                );
        }
    };

    /* Render: HTML */
    // Formula.prototype.fnTpl = function(_arr, _path) {

    // }

    Formula.prototype.toHtml = function(_arr, _path) {
        return '<span>' + this.storage.toHtml(this.cursor) + '</span>';
    };

    Formula.prototype.render = function() {
        this.isCalculated = false;
        calc._cache.inputField.innerHTML = this.toHtml();
    };

    // Reset the display.
    Formula.prototype.reset = function() {
        calc._cache.$formulaMinor.html('');
        calc._cache.inputField.innerHTML = '0';
        this.storage = newZeroFieldCollector();
        // this._cursor = new DisplayPos([0]);
        this.cursor = new DisplayPos([0]);
        this.initialDisplay = true;
        this.render();
    };

    // Calc engine
    var calc = {
        _cache: {},

        settings: {
            keys: {
                // hotkeys to catch with no focus on calc UI
                global: '1234567890^*-+('
                // Keys that conflict with global DDG keyshortcuts:
                //     /
            }
        },

        init: function init(wrapSel) {
            calc.settings.wrapSel = wrapSel;
            calc.cacheDom(wrapSel);
            calc.bindEvents(wrapSel);
        },
        cacheDom: function cacheDom(wrapSel) {
            calc._cache.$ctx = $(wrapSel);
            calc._cache.$inputDisplay = $(wrapSel + ' .tile__display');
            calc._cache.$inputTrap = $(wrapSel + ' .tile__input-trap');
            calc._cache.$inputField = $(wrapSel + ' .tile__display__main');
            calc._cache.$formulaMinor = $(wrapSel + ' .tile__display__aside');
            calc._cache.inputField = calc._cache.$inputField.get(0);
            calc._cache.$skipCalc = $(wrapSel + ' .tile__skip-calc');

            calc._cache.$historyTab = $(wrapSel + ' .tile__history');
            calc._cache.$historyItemTpl = $(wrapSel + ' .tile__past-calc__tpl');
        },

        //////////////
        /// EVENTS ///
        //////////////
        bindEvents: function bindEvents() {
            calc.bindUtilityEvents();
            // Capture related keystrokes from global ctx
            $(document).keypress(calc.handlers.globalKeyEvent);
            // Capture keystrokes from input trap which allows for wider range of keyCodes
            calc.bindTrapKeyEvents();
            // Capture UI clicks
            calc.ui.bindBtnEvents();
            // handle focus via mouse on input field
            calc._cache.$inputDisplay.on('click', calc.ui.focusInput);

            calc.ui.bindTabControls();

            // TODO Handle paste within the calculator UI
            //calc._cache.$ctx.on('paste', calc.handlers.paste);
        },

        /**
         * Bind extra events (Accessibility for calc skipping)
         */
        bindUtilityEvents: function bindUtilityEvents() {
            // Accessibility skip calc UI
            calc._cache.$skipCalc.on('click keydown', function(e){
                e.preventDefault();
                e.stopImmediatePropagation();
                if (e.type === 'keydown' && [K.SPACE, K.ENTER].indexOf(e.keyCode) !== -1) {
                    console.log('e [CAUG]:', e);
                    $(window).scrollTo('.content-wrap'); // TORETHINK: too much?
                    $('.content-wrap a, .content-wrap input').get(0).focus(); // TORETHINK: No visual indication
                } else {
                    console.log('e:', e);
                }
            });
        },

        /**
         * Bind events for full-input mode using an input trap
         */
        bindTrapKeyEvents: function bindTrapKeyEvents() {
            calc._cache.$inputTrap.keydown(function(e) {
                console.log('[inputTrap.keydown] e', e);
                var key = e.keyCode;
                if (key === K.BACKSPACE) {
                    if (e.shiftKey) {
                        calc.process.clearFull();
                    } else {
                        calc.process.backspace();
                    }
                    Utils.cancelEvent(e);
                    return false;
                } else if (key === K.RIGHT_ARROW) {
                    calc.process.rightArrow();
                } else if (key === K.LEFT_ARROW) {
                    calc.process.leftArrow();
                } else {
                    e.stopPropagation();
                }
                e.stopImmediatePropagation();
            });
            calc._cache.$inputTrap.keypress(function(e) {
                console.log('[inputTrap.keypress] e', e);
                // process key
                calc.process.key(e.keyCode);
                calc.ui.focusInput();
                Utils.cancelEvent(e);
            });
            calc._cache.$inputTrap.keyup(function(e) {
                console.log('[inputTrap.keyup] e', e);
                if (e.keyCode === K.ESC) {
                    e.target.blur();
                }
                Utils.cancelEvent(e);
            });
        },

        ////////
        /// Handlers
        handlers: {
            /**
             * Handles keypresses of specific keys on global context
             * to bring focus to the calculator
             *
             * Doesn't react to:
             * - keypresses that belong to input elements
             * - keys that are not on the whitelist
             * @param  {jQuery.Event} e Keypress event
             */
            globalKeyEvent: function (e) {
                if (
                    e.target && (
                        e.target.tagName === 'INPUT' ||
                        e.target.className.indexOf('tile__ctrl__btn') !== -1
                    )
                ) {
                    // Ignore keys to inputs foreign to the calculator
                    console.log('[handlers] ignore due to target:', e);
                    return;
                }
                var chr = String.fromCharCode(e.keyCode || 0);
                if (calc.settings.keys.global.indexOf(chr) !== -1) {
                    console.log('[calc.keypress.global] [CAUGHT] globalKey:', e.keyCode, 'char:', chr, 'e:', e);
                    Utils.cancelEvent(e);
                    // process key
                    calc.process.key(e.keyCode);
                    return false;
                } else {
                    console.log('[calc.keypress.global] [IGNORED] globalKey:', e.keyCode, 'char:', chr, 'e:', e);
                }
            },

            paste: function(e) {
                // TODO
            }
        },

        /////////
        /// UI
        ui: {
            bindBtnEvents: function() {
                $('.tile__tabs .tile__ctrl__btn', calc._cache.$ctx)
                    .on('click keypress', function(e) {
                        if (e.type === 'keypress' && e.keyCode === K.BACKSPACE) {
                            calc.process.backspace();
                            return;
                        }

                        if (
                            e.type === 'keypress' &&
                            [K.ENTER, K.SPACE].indexOf(e.keyCode) !== -1
                        ) {
                            // TODO maybe needs prevent default etc.
                            // TODO [accessibility] Decide on Enter & Space roles when use while focused on btns
                            return;
                        }

                        var $this = $(this);
                        var cmd = $this.data('cmd');
                        if (cmd === 'NO') return;

                        if (cmd === undefined) {
                            console.log("[bindBtnEvents] got undefined command");
                            console.log("textContent: " + this.textContent);
                            calc.process.chr(this.textContent);
                        } else {
                            console.log('[bindBtnEvents] processing command: ' + cmd);
                            calc.process.cmd(BTS[cmd]);
                        }

                        if (e.type === 'click') {
                            console.log('[AMPER] btn.click:', e);
                            calc.ui.focusInput();
                        }
                    });
            },
            bindTabControls: function() {
                // TODO: Perf refactor
                $('.tile__options .tile__option span').click(function(e) {
                    var $tabHandle = $(this).parent();
                    if ($tabHandle.hasClass('tile__option--active')) {
                        return;
                    }
                    $('.tile__options .tile__option')
                        .removeClass('tile__option--active');
                    $tabHandle.toggleClass('tile__option--active');

                    var activeTab = $('.tile__options .tile__option.tile__option--active')
                                        .data('tab');
                    $('.tile__tabs')
                        .removeClass(function (index, css) {
                            return (css.match(/(^|\s)tile__tabs--single-[a-z]+/g) || []).join(' ');
                        })
                        .addClass('tile__tabs--single-'+activeTab);
                });
            },
            focusInput: function () {
                console.log('FOCUS on inputTrap');
                calc._cache.$inputTrap.focus();
            },
            blurInput: function () {
                calc._cache.$inputTrap.blur();
            }
        },


        /**
         * @type {Formula}
         */
        formula: new Formula(),

        /**
         * History manager
         * @type {Object}
         */
        history: {
            add: function(result) {
                // TODO Set the previous result so it can be used in
                // calculations.
                var $newCalc = calc._cache.$historyItemTpl.clone();
                $newCalc.removeClass('hide tile__past-calc__tpl');
                $newCalc.find('.tile__past-formula').html(result.parsed_input);
                // The different result formats
                var results = [result.fraction, result.decimal].filter(function (elt) {
                    return elt !== null;
                });
                $newCalc.find('.tile__past-result').html(results[0]);
                calc._cache.$historyTab.prepend($newCalc);
                setTimeout(function() {
                    $newCalc.removeClass('tile__past-calc--hidden');
                }, 20);
                var nextIdx = 0;
                // Clicking the last result changes which format is displayed
                $('.tile__past-result').on('click', function(event) {
                    event.stopImmediatePropagation();
                    nextIdx = (nextIdx + 1) % results.length;
                    $(this).html(results[nextIdx]);
                });
                // Clicking the history adds the result to the input.
                $('.tile__past-calc').on('click', function(event) {
                    event.stopImmediatePropagation();
                    var val = $(this).find('.tile__past-result').val();
                    calc.process.calculation(val);
                });
            },
            remove: function(formulaId) {
                // TODO
            },
            // Gonna assume this is put result back into input...
            replay: function(formulaId) {
                console.log('[replay] formulaId: ' + formulaId);
                // TODO
            }
        },

        /**
         * Normalize input flows
         * @type {Object}
         */
        process: {
            // Higher level

            // Called by search query init
            calculation: function (formulaStr) {
                console.log("[calc.process.calculation] got formulaStr: " + formulaStr);
                // sanitize
                // decimal dots?
                for (var i = 0; i < formulaStr.length; i++) {
                    console.log('[calc.process.calculation] passing character');
                    calc.process.chr(formulaStr[i]);
                }
            },
            cmd: function(cmd) {
                if (cmd === undefined) {
                    console.warn('[calc.process.cmd] got undefined command!');
                    return;
                }
                if (typeof cmd === 'function') {
                    cmd = cmd();
                }
                var type = cmd.actionType;
                if (type === 'META') {
                    cmd.runAction();
                    return;
                }
                calc.formula.handleCmd(cmd);
            },

            // Low level
            key: function (key) {
                calc.ui.focusInput();
                console.log('[calc.process.key] got key: ' + key);
                switch (key) {
                case K.ENTER:
                    return calc.process.cmd(BTS.META_PROCEED);
                case K.BACKSPACE:
                    return calc.process.cmd(BTS.META_CLEAR);
                case K.LEFT_ARROW:
                    return calc.process.leftArrow();
                case K.RIGHT_ARROW:
                    return calc.process.rightArrow();
                }
                var chr = String.fromCharCode(key || 0);
                calc.process.chr(chr, key);
            },
            chr: function (chr) {
                if (KEY_ALIASES[chr] !== undefined) {
                    var alias = KEY_ALIASES[chr];
                    calc.process.cmd(BTS[alias]);
                    return;
                }
                calc.formula.handleChr(BTS[chr]);
            },
            backspace: function () {
                calc.formula.handleBackspace();
            },
            clearFull: function () {
                calc.formula.reset();
            },
            leftArrow: function() {
                calc.formula.traverseBackward();
            },
            rightArrow: function() {
                calc.formula.traverseForward();
            }
        }
    };
    var updateGUI = function() {
        var query = $("#tile__past-formula").val();
        $.getJSON("https://crossorigin.me/" + "https://api.duckduckgo.com/?format=json&q=" + query, function(data) {
            var answerComponents = data.Answer.match(/^([0-9\.,]+) ([a-zA-Z].*)$/);
            var answerValue = answerComponents[1].replace(/,/g,"");

            $("#tile__past-calc").val(answerValue);
        });
    };

    return {
        onShow: function() {
            var isInited = $('#zci-calculator').data('is-inited');
            if (!isInited) {
                $('#zci-calculator').data('is-inited', true);
                calc.init('#zci-calculator');
                var query = DDG.get_query();
                if (query !== 'calculator') {
                    calc.process.calculation(query);
                    calc.formula.calculate();
                }
            }
        }
    };
};

Handlebars.registerHelper('iterate', function(context, options) {
    out = "";
    if (options.data) {
        data = Handlebars.createFrame(options.data);
    }
    var times = context;
    var start = options.hash.start || 0;
    var step = options.hash.step || 1;
    var end = options.hash.end || start + step * (times - 1);
    // var end = options.hash['end'];
    for (var i=start; i<=end; i+=step) {
        if (data) {
            data.this = i;
        }
        out += options.fn(data.this);
    }
    return out;
});


function MK85CPU(name) {
    this.name           = name;
    /* registers */
    this.reg            = new Uint16Array(8);
    /* NOTE
     *  R6 is Stack Pointer,
     *  R7 is Instructioin Pointer,
     *  PSW is Processor Status Word.
     */
    this.regSel         = 0x0000;   // HALT mode
    this.psw            = 0x0000;
    this.pc             = 0x0000;
    this.cpc            = 0x0000;
    this.cps            = 0x0000;
    this.opcode         = 0x0000;
	this.readCallback   = null;
    this.writeCallback  = null;

    this.debug = false;

    this._H = 0x0100;
    this._I = 0x0080;
    this._T = 0x0010;
    this._N = 0x0008;
    this._Z = 0x0004;
    this._V = 0x0002;
    this._C = 0x0001;
    this._RESET_VECTOR          = 0x0000;
    this._MEMORY_ACCESS_TRAP    = 0x0004;
    this._ILLEGAL_OPCODE_TRAP   = 0x0008;
};

MK85CPU.prototype.readWord = function(addr)  {
    return this.readCallback(addr)|(this.readCallback(addr+1)<<8);
};

MK85CPU.prototype.writeWord = function(addr, word)  {
    this.writeCallback(addr++, word&0xFF);
    this.writeCallback(addr, (word>>8)&0xFF);
};

MK85CPU.prototype.doVector = function(vectorAddr) {
    /* Перейти на вектор */
    this.reg[7] = this.readWord(vectorAddr);
    this.psw = this.readWord(vectorAddr+2);
    if(this.debug)
    {
        console.log("go to vector",
                    "\nIP  = ", this.reg[7].toString(16),
                    "\nPSW = ", this.psw.toString(16));
    };
};

MK85CPU.prototype.access = function(addr,writeVal,isByte) {
    if(writeVal === null) {
        return this.readCallback(addr)|(isByte?0:this.readCallback(addr+1)<<8);
    } else {
        this.writeCallback(addr,writeVal&0xFF);
        if(!isByte) this.writeCallback(addr+1,(writeVal>>8)&0xFF);
        return null;
    };
};

MK85CPU.prototype.addressMode = function(addrMode,val,isByte) {
    /* warning ! increments IP if mode is 'index deferred' */
    var regIndex = addrMode&7;
    switch((addrMode>>3)&0x07)
    {
        /* register */
        case 0: 
        {
            if(val===null) {
                return this.reg[regIndex];
            } else {
                this.reg[regIndex] = val;
                return null;
            };
        };
        /* register deferred */
        case 1: return this.access(this.reg[regIndex], val, isByte);
        /* autoincrement */
        case 2: 
        {
            var i = this.access(this.reg[regIndex], val, isByte);
            this.reg[regIndex] += isByte?1:2;
            return i;
        };
        /* autoincrement deferred */
        case 3:
        {
            var i = this.access(this.access(this.reg[regIndex], null, false), val, isByte);
            this.reg[regIndex] += 2;
            return i;
        };
        /* autodecrement */
        case 4:
        {
            this.reg[regIndex] -= isByte?1:2;
            return this.access(this.reg[regIndex], val, isByte);
        };
        /* autodecrement deferred */
        case 5:
        {
            this.reg[regIndex] -= 2;
            return this.access(this.access(this.reg[regIndex], null, false), val, isByte);
        };
        /* index */
        case 6:
        {
            var i =  this.access((this.reg[regIndex]+this.access(this.reg[7], null, false)), val, isByte);
            this.reg[7]+=2;
            return i;
        };
        /* index deferred */
        case 7:
        {
            var i = this.access(this.access((this.reg[regIndex]+this.access(this.reg[7], null, false)), null, false), val, isByte);
            this.reg[7]+=2;
            return i;
        };
    };
};

MK85CPU.prototype.execInstruction = function() {
    /* Исполняет 1 машинную операцию */
    var opcode = this.access(this.reg[7], null, false);
    /* увеличиваем счетчик инструкций */
    this.reg[7]+=2;
    if(this.debug) console.log("IP = ",this.reg[7].toString(16),"opcode = ",opcode.toString(16));

};

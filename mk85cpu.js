
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

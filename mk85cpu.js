
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
    this.sel			= 0x0000;
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
    this._TRAP_BUS_ERROR        = 0x0004;
    this._TRAP_RESERVED_OPCODE  = 0x0008;
    this._TRAP_T_BIT            = 0x000C;
    this._TRAP_IO               = 0x0010;
    this._TRAP_ACLO             = 0x0014;
    this._TRAP_EMT              = 0x0018;
    this._TRAP_TRAP             = 0x001C;
    this._TRAP_EVNT             = 0x0020;
    this._HALT_TRAP             = 0x0078;
    this._TRAP_WIR              = 0x00A8;
};

MK85CPU.prototype.reset = function() {
	this.doVector(this._RESET_VECTOR);
};

MK85CPU.prototype.doVector = function(vectorAddr) {
	/* положить SP и IP на стек */
	var PS = this.reg[6];
	var PC = this.reg[7];
	this.reg[6]-=2;
	this.access(this.reg[6], PS, false);
	this.reg[6]-=2;
	this.access(this.reg[6], PC, false);
    /* Перейти на вектор */
    this.reg[7] = this.access(0, null, false);
    this.psw = this.access(vectorAddr+2, null, false);
    if(this.debug)
    {
        console.log("go to vector (oct)", vectorAddr.toString(8),
                    "\nIP  = ", this.reg[7].toString(16),
                    "\nPSW = ", this.psw.toString(16));
    };
};

MK85CPU.prototype.access = function(addr,writeVal,isByte) {
	if(!isByte && addr&1) { this.doVector(this._TRAP_BUS_ERROR); }; // TRAP 4, boundary error
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

MK85CPU.prototype.getSrc = function(opcode) { return (opcode>>6)&0x3F; };
MK85CPU.prototype.getDst = function(opcode) { return (opcode)&0x3F; };

/* Just a bit of eye-candy */
MK85CPU.prototype.flipFlag = function(flag, cond) {
	this.psw = (cond)?(this.psw|=flag):(this.psw&=~(flag));
};

MK85CPU.prototype.execInstruction = function() {
    /* Исполняет 1 машинную операцию */
    var opcode = this.access(this.reg[7], null, false);
    /* увеличиваем счетчик инструкций */
    this.reg[7]+=2;

	switch((opcode>>12)&0x07)
	{
		case 0:
		{
			switch((opcode>>9)&0x07)
			{
				case 0:
				{
					switch((opcode>>6)&0x07)
					{
						case 1:	// JMP
						{
							if(this.getDst(opcode)&0x38)
							{
								this.reg[7] = this.addressMode(this.getDst(opcode), null, false);
							} else {
								this.doVector(this._TRAP_RESERVED_OPCODE);
							};
						};
					};
				};
			};
		};
		case 1:	// MOV[B]
		{
			var src = this.addressMode(this.getSrc(opcode), null, opcode&0x8000);
			this.addressMode(this.getDst(opcode), src, opcode&0x8000);
			this.flipFlag(this._N, (src<0));
			this.flipFlag(this._Z, (src==0));
			this.flipFlag(this._V, false);
			break;
		};
		case 2: // CMP[B]
		{
			var src = this.addressMode(this.getSrc(opcode), null, opcode&0x8000);
			var dst = this.addressMode(this.getDst(opcode), null, opcode&0x8000);
			var result = src + (~dst) + 1;
			this.flipFlag(this._N, (result < 0));
			this.flipFlag(this._Z, (result == 0));
			this.flipFlag(this._C, (result <= 0xFFFF));
			this.flipFlag(this._V, ((dst^src)&(~(dst^result))&0x8000));	// ???
			break;
		};
		case 3: // BIT[B]
		{
			var src = this.addressMode(this.getSrc(opcode), null, opcode&0x8000);
			var dst = this.addressMode(this.getDst(opcode), null, opcode&0x8000);
			var result = src&dst;
			this.flipFlag(this._N, (opcode&0x8000)?(result&0x80):(result&0x8000));
			this.flipFlag(this._Z, (result == 0));
			this.flipFlag(this._V, false);
			break;
		};
		case 0: // команды с 1 операндом + команды перехода
		{
			if(opcode&(0x400)) {    // single operand
			    switch((opcode>>6)&0x1F)
			    {
			        // SWAB
			        // CLR[B]
			        // COM[B]
			        // INC[B]
			        // DEC[B]
			        // NEG[B]
			        // ADC[B]
			        // SBC[B]
			        // TST[B]
			        // ROR[B]
			        // ROL[B]
			        // ASR[B]
			        // ASL[B]
			        // MARK
			        // MTPS
			        // MFPI
			        // MFPD
			        // MTPI
			        // MTPD
			        // SXT
			        // MFPS
			    };
			} else {                // conditional branch
			    // HALT
			    
			};
			break;
		};
		case 7:
		{
		    // Some additional two-operand instructions
		    // MUL, DIV, ASH, ASHC, XOR, (floating point things), (system instructions), SOB
		    switch((opcode>>9)&0x07) {
		        case 5:
		        {
		            /* несуществующие функции с плавающей запятой */
		            if(this.sel&0x80)
		            {
		                this.doVector(this._TRAP_RESERVED_OPCODE);
		            } else {
		                /* переход в режим HALT */
		                this.flipFlag(this._H, true);
		                this(this.sel&0xFF00)|0x08;
		            };
		            break;
		        };
		    };
		    break;
		};
//		case 4:
	};

    if(this.debug) console.log("IP = ",this.reg[7].toString(16),"opcode = ",opcode.toString(16));

};
MK85CPU.prototype.HALT = function(vector) {
	this.cpc = this.reg[7];
	this.cps = this.reg[6];
	if(this.psw&this._H) this.reg[7] = 0x78|(this.sel&0xFF00);
};


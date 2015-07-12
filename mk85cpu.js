function MK85CPU(name) {
    this.name           = name;
    /* registers */
    this.reg            = new Uint16Array(8);
    this.regSel         = 0x0000;   // HALT mode
    this.psw            = 0x0000;
    this.pc             = 0x0000;
    this.cpc            = 0x0000;
    this.cps            = 0x0000;
	this.readCallback   = null;
    this.writeCallback  = null;
/*    H_bit	= $100;	{ HALT/USER mode }
    I_bit	= $80;	{ interrupt priority }
    T_bit	= $10;
    N_bit	= $08;
    Z_bit	= $04;
    V_bit	= $02;
    C_bit	= $01;*/
}


const addInvisibleDots = true;
const convertE = true;
const convertI = true;
//Parsing constants
const zerocode = '0'.charCodeAt(0);
const ninecode = '9'.charCodeAt(0);
const slashcode = '\\'.charCodeAt(0);
const dotcode = '.'.charCodeAt(0);
const isSymbol = (code = 0) => {
    return (code <= 63 && code >= 58) || (code <= 47 && code >= 33)
        || (code <= 126 && code >= 123) || (code <= 96 && code >= 91) || code === ' '.charCodeAt(0);
};
const acode = 'a'.charCodeAt(0);
const zcode = 'z'.charCodeAt(0);
const Acode = 'A'.charCodeAt(0);
const Zcode = 'Z'.charCodeAt(0);

/**
 * Check and returns the type of the given character
 * @param {string} c The character
 * @returns {string} type can be one of digit, symbol, letter or '.'
 */
function getCharType(c:string) {
    let code = c.charCodeAt(0);
    if(convertI&&c=='i'){
        return "symbol";
    }
    if(convertE&&c=='e'){
        return "symbol";
    }
    if (code <= ninecode && code >= zerocode)
        return "digit";
    else if (c === '.')
        return ".";
    else if (c===' ')
        return "space";
    else if ((code <= zcode && code >= acode) || (code <= Zcode && code >= Acode))
        return "letter";
    else
        return "symbol";
}

type MStruct = {[key:string]:MStruct | [string, string, number]};
// Item structure: [name, type, sub-clause count]
let macros:MStruct = {
    'i': ['i', 'constant', 0],
    'e': ['e', 'constant', 0],
    '{': ['{', 'openstruct', 0],
    '}': ['}', 'closestruct', 0],
    '(': ['(', 'openstruct', 0],
    ')': ['(', 'closestruct', 0],
    ',': [',', 'optstruct', 0],
    '$': ['$', 'closestruct', 0],
    '+': ['add', 'operator', 0],
    '-': ['sub', 'operator', 0],
    '*': ['mul', 'operator', 0],
    '/': ['div', 'operator', 0],
    '^': ['pow', 'operator', 0],
    '=': ['equal', 'operator', 0],
    '!': ['factorial', 'operator', 0],
    '\\': {
        ' ': ['space', 'structure', 0],
        'c': {'d': {'o': {'t': ['dot', 'operator', 0],
                }
            },
            'o': {
                's': ['cos', 'function', 1],
                't': ['cot', 'function', 1]
            },
        },
        'd': {
            'i': {
                'v': ['div', 'operator', 0]
            }
        },
        'f': {
            'r': {
                'a': {
                    'c': ['frac', 'function', 0]
                }
            }
        },
        /*
         *  Integration takes four subclauses, the first and second are the lower and upper bounds, the third is the integrand,
         *  and the last is the integration variable d$.
         */
        'i':{
            'n':{
                't': ['integrate', '$', 4]
            }
        },
        'l': {
            'n': ["ln", 'function', 0],
            'e': {
                'f': {
                    't': {
                        '(': ['(', 'openstruct', 0],
                        '|': ['|', 'openstruct', 1],
                        '{': ['{', 'openstruct', 0],
                        '[': ['[', 'openstruct', 0],
                    }
                }
            }
        },
        'm': {
            'a': {
                't': {
                    'h': {
                        'b': {
                            'f':{
                                '{':{
                                    'd':{
                                        '}':['diff', 'closestruct', 1], //especially used for defining differential operator d
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        'p': {
            'i': ['pi', 'constant', 0],
            'r': {
                'o': {
                    'd': ['prod', 'operator', 2]
                }
            }
        },
        'r': {
            'i': {
                'g': {
                    'h': {
                        't': {
                            ')': [')', 'closestruct', 0],
                            '|': ['|', 'closestruct', 0],
                            '}': ['}', 'closestruct', 0],
                            ']': [']', 'closestruct', 0],
                        }
                    }
                }
            }
        },
        's': {
            'i': {
                'n': ['sin', 'function', 1]
            },
            'u': {
                'm': ['sum', 'operator', 2]
            },
            'q': {
                'r': {
                    't': ['sqrt', 'function', 1]
                }
            }
        },
        't': {
            'a': {
                'n': ['tan', 'function', 1]
            },
            'i': {'m': {'e': {'s': ['cross', 'operator', 0]}}},
        },
        'v': {
            'e': {
                'c': ['vector', '$', 1]
            }
        },
    }
};

class Token{
    //Possible types include: function, operator, openstruct, closestruct, #, $
    type: string = 'none';
    content: string;
    //Indices for the token in the list
    start: number=0;
    //One plus the index of the last character of this token in the tex string
    end: number=0;
    clauseCount = 0;
    subClauses: Token[][];
    parentClause: Token[];
    //For temporary storage of SymNodes in vector parsing
    subNodes: SymNode[];
    TeX: string="";

    /**
     * Parses the content of the tex string starting at specified positions to
     * get this token's contents
     * @param start the position at which this token starts
     * @param tex the entire tex string from the input
     * @param previousType type of the previous token
     * @return parseConstant indicating if there are any errors in the syntax during parsing,
     *                       0: parse successfully terminated, 1: unrecognized character
     */
    readFrom(tex:string, start: number, previousType:string):number{
        this.start = start;
        let state = 'init';
        let macro:MStruct|Array<number|string> = macros;
        let i = start;
        let terminating = false;
        let dotCount = 0;
        while(!terminating){
            this.end = i;
            let char = tex[i];
            if(char == undefined)
                return 0;
            let cType = getCharType(char);
            switch(state){//Enter into the main clause of the state machine depending on the state
                case 'init':
                    switch(cType){
                        case 'digit':
                            state = 'number';
                            this.type = '#';
                            this.content = char;
                            break;
                        case '.':
                            state = 'number';
                            this.type = '#';
                            this.content = char;
                            dotCount = 1;
                            break;
                        case 'letter':
                            state = 'variable';
                            this.type ='$';
                            this.content = char;
                            break;
                        case 'symbol':
                            if((macro = macros[char])==undefined)return 1;
                            state = 'macro';
                            this.type = 'incompleteMacro';
                            if(macro instanceof Array){
                                this.content = <string>macro[0];
                                this.type = <string>macro[1];
                                this.clauseCount = <number> macro[2];
                            }
                            break;
                        case 'space':
                            this.type = 'structure';
                            this.content = 'space';
                            break;
                    }
                    break;

                case 'number':
                    switch (cType) {
                        case 'digit':
                            this.content += char;
                            break;
                        case '.':
                            if(dotCount==0){
                                this.content += char;
                                dotCount = 1;
                            }
                            else terminating = true;
                            break;
                        case 'letter': terminating = true;
                            break;
                        case 'symbol':
                        case 'space':
                            terminating = true;
                    }
                    break;
                case 'variable':
                    switch(cType){
                        case '.':
                        case 'digit':
                        case 'letter':
                            terminating = true;
                            break;
                        case 'symbol':
                        case 'space':
                            if(convertE&&this.content == 'e'){
                                this.type = "constant";
                                terminating = true;
                                break;
                            }
                            if(char == '_') state = 'var_';
                            else if(tex.substr(i, 6)=='\\left(')
                                return this.parseClauses(tex, i, 1);
                            else terminating = true;
                    }
                    break;
                case 'var_':
                    switch (cType) {
                        case 'digit':
                        case 'letter':
                            this.content += char;
                            //queue for termination after one extra round (the next char will be ignored)
                            state = 'var_{}';
                            break;
                        case 'symbol':
                        case 'space':
                            if(char == '{') state = 'var_{';
                            else if(char != ' ') return 1;
                            break;
                        case 'dot': return 1;
                    }
                    break;
                case 'var_{':
                    if(char != '}') this.content += char;
                    else state = 'var_{}';
                    break;
                case 'var_{}':
                    if(tex.substr(i, 6)=='\\left(') return this.parseClauses(tex, i, 1);
                    else terminating = true;
                    break;
                case 'macro':
                    if(macro instanceof Array) {
                        terminating = true;
                        this.checkNegation(previousType);
                        return this.parseClauses(tex, i, this.clauseCount);
                    }else if((macro = macro[char])!=undefined){
                        if(macro instanceof Array) {
                            this.content = <string>macro[0];
                            this.type = <string>macro[1];
                            this.clauseCount = <number>macro[2];
                        }
                    }else return 1;
                    break;
                case 'space':
                    switch(cType){
                        case 'space':
                            break;
                        default:
                            terminating = true;
                    }
                    break;
                case 'terminating':
                    terminating = true;
            }
            if(!terminating)
                this.TeX+=char;
            i++;
        }
        return 0;
    }

    /**
     * Serves to parse the subclauses of a token given that it is
     * an operator permitting subclauses
     *
     * @return parseConstant indicating if there are any errors in the syntax during parsing,
     *                       0: parse successfully terminated, 1: unrecognized character
     */
    parseClauses(tex: string, start: number, clauseCount:number): number{
        if(clauseCount == 0){
            return;
        }else{
            this.subClauses = [];
        }
        let i = start;
        switch(this.content){
            case 'sum':
            case 'prod':
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                break;
            case 'integrate':
                //Parse lower bound
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                //Parse upper bound
                if(tex.charAt(i)=='_') i = this.parseSubClause(tex, i+1, 0);
                else if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 1);
                else return 1;
                //Parse integrand
                let parser = new Parser();
                i = parser.linParse(tex, i, new Token(), new Structure('diff', this));
                this.subClauses[3] = [parser.tokenList[parser.tokenList.length-1]];
                this.subClauses[2] = parser.tokenList;
                break;
            case 'diff':
                let token = new Token();
                token.readFrom(tex, start, 'diff');
                if(token.type!='$')
                    return 1;
                this.subClauses[0]=[token];
                i = token.end;
                break;
            case 'cos':
            case 'sin':
            case 'cot':
            case 'tan':
                if(tex.charAt(i)=='^') i = this.parseSubClause(tex, i+1, 0);
                else {
                    this.subClauses.length = 0;
                    this.clauseCount = 0;
                }
                break;
            case 'vector':
                i = this.parseSubClause(tex, i, 0);
                if(this.subClauses[0].length!=2||this.subClauses[0][0].type!='$'){
                    return 1;
                }
                this.clauseCount = 0;
                this.content = '>'+this.subClauses[0][0].content;
                break;
        }
        if(this.type == '$'){
            if(tex.substr(i, 6)=='\\left('){
                let openStruct = new Token();
                openStruct.type = 'openstruct';
                openStruct.content = '(';
                openStruct.start = start;
                openStruct.end = start+6
                i = start+6;
                let parser;
                do {
                    parser = new Parser();
                    i = parser.linParse(tex, i, openStruct, new Structure(',)', openStruct));
                    this.subClauses.push(parser.tokenList);
                }while(parser.tokenList[parser.tokenList.length-1].content!=')');
                this.clauseCount = this.subClauses.length;
                this.type = 'func$';
            }
        }
        this.end = i;
    }

    /**
     * Parse for a particular sub-clause beginning with '{' and ending with '}'
     * @param tex the entire tex string
     * @param start the beginning of the sub-clause, '{' included
     * @param clauseIndex the sub-clause that the parsed segment of string belongs to
     */
    parseSubClause(tex: string, start: number, clauseIndex:number):number{
        let end;
        if(tex.charAt(start)=='{'){
            let parser = new Parser();
            let openStruct = new Token();
            openStruct.type = 'openstruct';
            openStruct.content = '{';
            openStruct.start = start;
            openStruct.end = start+1;
            end = parser.linParse(tex, start+1, openStruct, new Structure('}', openStruct));
            this.subClauses[clauseIndex] = parser.tokenList;
        } else {
            let token = new Token();
            token.readFrom(tex, start, 'openstruct');
            this.subClauses[clauseIndex]=[token];
            end = token.end;
        }
        return end;
    }

    /**
     * Called to check if '-' should be parsed to a
     * subtraction operator or a negation operator
     * @param previousType
     */
    checkNegation(previousType: string){
        if(this.content=='sub'){
            if(previousType==undefined||previousType=='none'||previousType=='operator'||previousType=='openstruct'
            ||previousType=='optstruct'){
                this.content = 'neg';
            }
        }
    }
}

// Token.prototype.toString = function(){
//     return this.type+':'+this.content;
// }

class SymNode {
    children: SymNode[] = [];
    content: string;
    subClauses: SymNode[] = [];
    token: Token;
    // '#' for number, '$' for variable, 'func$' for functional variable, 'operator' for operator.
    type: string;

    /**
     * Retrieves all leaf nodes underlying this statement tree.
     */
    getLeaves(): SymNode[] {
        let leaves: SymNode[] = [];
        for(let clause of this.subClauses) {
            if(clause == undefined)
                throw new ReferenceError("incomplete expression");
            leaves.push(...clause.getLeaves());
        }
        if(this.children.length == 0) {
            leaves.push(this);
            return leaves;
        }
        for(let child of this.children) {
            if(child == undefined)
                throw new ReferenceError("incomplete expression");
            leaves.push( ...child.getLeaves());
        }
        return leaves;
    }
}

/**
 * Inside the formats are instructions for the matching of various structures. In the parse stack,
 * a close close parenthesis shall be inserted on account of each open parenthesis, and all closing structures
 * that match the top of the parse stack will cause a pop instruction, otherwise they throw errors.
 */
let formats:{[key:string]:string} = {
    '(':')',
    '{':'}',
    '$':'$',
    '[':']',
}

//Class for items in the parse stack, representing structure typed tokens
class Structure{
    identifier: string;
    //The token that serves as the open structure corresponding to this (closing structure)
    //The start and end index insides destination can be particularly helpful when raising parsing errors
    destination: Token;
    constructor(identifier:string, destination: Token) {
        this.identifier = identifier;
        this.destination = destination;
    }
}

class Parser{

    toStatementTree(latex:string){
        console.log(latex);
        try {
            this.linParse(latex+'$');
        } catch (e) {
            console.log(e);
        }
        console.log(this.tokenList);
        let statementTree = this.syParse(this.tokenList);
        this.syParseSubClauses(statementTree);
        console.log('Statement Tree: ')
        console.log(statementTree);
        return statementTree;
    }

    /**
     * The token list of this holds the result of linParse
     */
    tokenList:Token[] = [];
    /**
     * Parse stack helps keeps track of parenthesis, at its bottom, it also holds an exit string that signals
     * the termination of the current parsing level, and returns to the previous level by exiting the linParse function.
     */
    parseStack:Structure[] = [];

    /**
     *
     * @param tex
     * @param start
     * @param previousToken
     * @param terminator The structure representation of the token that causes the current level of parsing to terminate.
     * '$' is the default terminator for the root level parsing.
     */
    linParse(tex: string, start:number = 0, previousToken = new Token(),
             terminator:Structure = new Structure('$', previousToken)): number{
        this.tokenList.length=0;
        this.parseStack.push(terminator);
        let i = start;
        while (this.parseStack.length!=0&&i<tex.length){
            let token = new Token();
            //Starts reading the tex string starting from index i,
            let parseConstant = token.readFrom(tex, i, previousToken.type);
            if(token.type == 'structure'&&token.content == "space"){
                i=token.end;
                continue;
            }
            switch(parseConstant){
                case 1:
                    console.log(previousToken);
                    throw new SyntaxError('Unrecognized syntax at '+token.start+' on character '+tex[token.end]);
                default:
                    break;
            }
            if(addInvisibleDots){
                if((['closestruct', '$', '#', 'constant', 'func$'].indexOf(previousToken.type)!=-1)&&
                    (['$', 'function', 'func$', '#', 'constant'].indexOf(token.type)!=-1||token.content=='('||
                        token.type=='operator'&&['sum'].indexOf(token.content)!=-1)){
                    let invisDot = new Token();
                    invisDot.type = 'operator';
                    invisDot.start = invisDot.end = previousToken.end;
                    invisDot.content = 'invisdot';
                    this.tokenList.push(invisDot);
                }
            }
            this.tokenList.push(token);
            if(token.type == 'openstruct'){
                this.parseStack.push(new Structure(formats[token.content], token));
            }
            if(token.type == 'closestruct'){
                //Use index of to track multiple symbols
                if(this.parseStack[this.parseStack.length-1].identifier.indexOf(token.content)!=-1){
                    this.parseStack.pop();
                }
                else throw new SyntaxError('Mismatched closures between '+
                                this.parseStack[0].destination.content+' and '+token.content);
            }
            //Optional structure, breaks this parse when matched to closure identifiers,
            //otherwise converted to structure
            if(token.type == 'optstruct'){
                if(this.parseStack[this.parseStack.length-1].identifier.indexOf(token.content)!=-1){
                    this.parseStack.pop();
                    if(this.parseStack.length==0)//Modify type of trailing optstruct tokens in a token list
                        //to close structs, as this is the only way they are used
                        token.type = 'closestruct';
                }
            }
            previousToken = token;
            i = token.end;
        }
        return i;
    }

    /**
     * The core algorithm for parsing token list into statement trees, relies primarily
     * on shunting yard. Left/right associativity are differentiated for certain operators and functions.
     * @param tokenList the list of parsed tokens
     */
    syParse(tokenList: Token[]): SymNode{
        let shuntingYard:Token[] = [];
        let tray: SymNode[] = [];
        for(let token of tokenList){
            if(token.type == '$' ||token.type == '#' ||token.type == 'func$'||token.type == 'constant'){
                let node = new SymNode();
                node.type = token.type;
                node.content = token.content;
                node.token = token;
                tray.push(node);
            }else if(token.type == 'function' ||token.type == 'operator'){
                while(shuntingYard.length!=0&&shuntingYard[shuntingYard.length-1].type!='openstruct'
                    &&shuntingYard[shuntingYard.length-1].type!='vec'
                    &&this.compareAssociativity(shuntingYard[shuntingYard.length-1], token)) {
                    let operator = shuntingYard.pop();
                    this.collapseOperator(operator, tray);
                }
                shuntingYard.push(token);
            } else if(token.type == 'openstruct')
                shuntingYard.push(token);
            else if(token.type == 'closestruct'){
                //This clause also needs to take care of the unmatched close struct in the token list or subclauses
                let operator;
                while(shuntingYard.length!= 0 && formats[(operator=shuntingYard.pop()).content]!=token.content){
                    this.collapseOperator(operator, tray);
                }
                //After parenthesis, check one element down the parse stack for function invocation
                if(operator!=undefined&&operator.type=='openstruct'&&
                    token.content==')'&&shuntingYard[shuntingYard.length-1]!=undefined
                    &&shuntingYard[shuntingYard.length-1].type=='function'){
                    this.collapseOperator(shuntingYard.pop(), tray);
                }
                if(operator!=undefined&&operator.type=='vec'){
                    operator.subNodes.push(tray.pop());
                    let node = new SymNode();
                    node.children = operator.subNodes;
                    node.token = operator;
                    node.content = '$Q';
                    switch (token.content){
                        case ')':
                            node.type = 'vector';
                            break;
                        case ']':
                            node.type = 'array';
                            break;
                        default:
                            throw new SyntaxError("Unimplemented vector clause: "+token.content);
                    }
                    tray.push(node);
                }
                if(token.content=='diff'){
                    let node  = new SymNode();
                    node.type = '$';
                    node.content = token.subClauses[0][0].content;
                    node.token = token.subClauses[0][0];
                    if(tray.length==0)
                        tray.push(node);
                }
            }else if(token.type == 'optstruct'&& token.content == ','){//Vector parsing
                let operator;
                //Pop till the closest container
                while(shuntingYard.length!= 0 && formats[(operator=shuntingYard.pop()).content]==undefined) {
                    this.collapseOperator(operator, tray);
                }
                if(operator!=undefined&&operator.type!='vec'){
                    operator.type = 'vec';//Identify the openstruct as a vector container
                    operator.subNodes = [];
                }
                operator.subNodes.push(tray.pop());//Store the clause
                shuntingYard.push(operator);
            }
        }
        console.log(tray);
        return tray[0];
    }

    /**
     * Collapses the specified operator into the tray with
     * a newly instantiated SymNode enclosing it
     * @param operator
     * @param tray
     */
    collapseOperator(operator: Token, tray: SymNode[]){
        let node = new SymNode();
        node.type = operator.type;
        node.content = operator.content;
        node.token = operator;
        let operandCount = this.operatorChart[operator.content][2];
        for(let i = 0; i<operandCount; i++){
            node.children[operandCount-i-1]=tray.pop();
        }
        tray.push(node);
    }
    /**
     * Reuse syParse to generate statement trees for all subclauses recursively.
     * @param node
     */
    syParseSubClauses(node: SymNode) {
        if (node==undefined)
            return;
        if (node.token.subClauses != undefined && node.token.subClauses.length != 0) {
            node.subClauses = new Array<SymNode>(node.token.subClauses.length);
            // Parse subclauses of this node recursively.
            for (let i = 0; i < node.token.subClauses.length; i++) {
                let tokens = node.token.subClauses[i];
                let subnode = this.syParse(tokens);
                node.subClauses[i] = subnode;
                this.syParseSubClauses(subnode);
            }
        }
        // Parse subclauses of children nodes recursively.
        for (let child of node.children)
            this.syParseSubClauses(child);
    }

    /**
     * [left associativity, right associativity, parameter count],
     *
     * frac pops as soon as it meets other operators or functions with its high
     * left associativity.
     * It also has high right associativity so as to ensure that it always gets
     * in the stack ensuring that the fraction will get computed first prior to whatever
     * comes before it, except for when it encounters another fraction, which is already
     * an unlikely occurrence, in which case the first fraction is to be computed first before this.
     * @private
     */
    private operatorChart: {[key:string]:number[]}={
        'add': [1.5, 1, 2],
        'sub': [1.5, 1, 2],
        'mul': [3, 2, 2],
        'invisdot': [3, 2, 2],
        'dot': [3, 2, 2],
        'cross': [3, 2, 2],
        'div': [3, 2, 2],
        'frac': [8, 7, 2],
        'pow': [4, 5, 2],
        'equal': [0, 0, 2],
        'tan': [2.5, 6, 1],
        'cot': [2.5, 6, 1],
        'sin': [2.5, 6, 1],
        'cos': [2.5, 6, 1],
        'sum': [2.5, 6, 1],
        'prod': [2.5, 6, 1],
        'factorial': [6, 5, 1],
        'neg':[2.5, 6, 1],
        'ln': [5, 6, 1],
        'sqrt': [8, 7, 1],
    }
    /**
     * Returns true if opr1 has higher left associativity than opr2's
     * right associativity
     * @param opr1 left operator
     * @param opr2 right operator
     */
    compareAssociativity(opr1: Token, opr2: Token): boolean{
        return this.operatorChart[opr1.content][0]>=this.operatorChart[opr2.content][1];
    }
}

export {Parser, SymNode};
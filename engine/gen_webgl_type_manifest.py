#!/usr/bin/env python3
"""
Javascript code generation to produce fast type data lookups.
"""

from collections import defaultdict

OUTPUT_FILENAME = "webgltypes.js"

HEADER = ''''use strict'
// WebGL Types
// GL_TYPES is an object with one entry for each OpenGL type code.
// Each entry has, as fields:
// - name       (the name of the type as used by WebGL, 
//                  such that ''+gl[GL_TYPES[code].name] === code)
// - elementType    (the type of the constituent elements)
// - nelements  (the number of primitive elements per unit of this type.
// - nattributes (the number of vertex attribute locations taken up by this type. 1 except for matrix types)
//                  for example, FLOAT_MAT4 has 16 elements and FLOAT_VEC3 has 3.)
// - nbytes     (the number of bytes require to store something of this type.
//                  for example, FLOAT_MAT4 takes 64 bytes.)
// - TypedArray (a JS TypedArray capable of containing primitive elements,
//                  for example, FLOAT_MAT4 can be stored in Float32Array.)
// - uniformv   (the name of the WebGL uniform setter function, meant to be
//                  used like gl[GL_TYPES[code].uniformv](location,transpose,value) )
//
// GL_TYPE_CODES is an object that maps names to codes, such that gl[name] === GL_TYPE_CODES[name].

// Test that GL_TYPES and GL_TYPE_CODES matches OpenGL
// Must be given a webgl context in order to run.
export function GL_TYPES_test(gl) {
    for (const code in GL_TYPES) {
        if (''+gl[GL_TYPES[code].name] !== code) {
            console.error(`Mistake in GL_TYPES: Code ${code} is named ${GL_TYPES[code].name}, but gl[${GL_TYPES[code].name}] is ${gl[GL_TYPES[code].name]}.`);
        }
    }
    for (const name in GL_TYPE_CODES) {
        if (gl[name] !== GL_TYPE_CODES[name]) {
            console.error(`Mistake in GL_TYPE_CODES: gl[${name}] is ${gl[name]} but GL_TYPE_CODES[${name}] is ${GL_TYPE_CODES[name]}.`);
        }
    }
}

'''

# These are the types that can appear in attributes and uniforms in webgl 1.
# Cut-and-pasted from the standards tables at
# https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#data_types
wgl1_uniform_types = '''
FLOAT_VEC2 	0x8B50 	
FLOAT_VEC3 	0x8B51 	
FLOAT_VEC4 	0x8B52 	
INT_VEC2 	0x8B53 	
INT_VEC3 	0x8B54 	
INT_VEC4 	0x8B55 	
BOOL 	0x8B56 	
BOOL_VEC2 	0x8B57 	
BOOL_VEC3 	0x8B58 	
BOOL_VEC4 	0x8B59 	
FLOAT_MAT2 	0x8B5A 	
FLOAT_MAT3 	0x8B5B 	
FLOAT_MAT4 	0x8B5C 	
SAMPLER_2D 	0x8B5E 	
SAMPLER_CUBE 	0x8B60
'''

wgl1_data_types = '''
BYTE 	0x1400 	
UNSIGNED_BYTE 	0x1401 	
SHORT 	0x1402 	
UNSIGNED_SHORT 	0x1403 	
INT 	0x1404 	
UNSIGNED_INT 	0x1405 	
FLOAT 	0x1406
'''

names = {k:v for (v,k) in [
    l.split() for l in 
        wgl1_uniform_types.split('\n') + 
        wgl1_data_types.split('\n')
    if len(l.split()) == 2
    ]
}

# From the Open GL ES 2.0 spec (2.10.4)
# This implies that either f32 or i32 arrays can be used to store booleans.
# I chose i32 because it might (?) be slightly more efficient.
'''
When loading values for a uniform declared as a boolean, a boolean vector,an array of booleans, or an array of boolean vectors, both the Uniform*i{v} and Uniform*f{v} set of commands can be used to load boolean values. Type conversion is done by the GL. The uniform is set to FALSE if the input value is 0 or 0.0f,and set to TRUE otherwise.
'''

# Determine base types
#   name              [kind,nelements,nbytes,constructor,is_sampler]
types = {
    'BYTE'          : ['i',1,1,'Int8Array', False],
    'UNSIGNED_BYTE' : ['i',1,1,'Uint8Array',False], 
    'SHORT'         : ['i',1,2,'Int16Array',False],
    'UNSIGNED_SHORT': ['i',1,2,'Uint16Array',False],
    'INT'  	        : ['i',1,4,'Int32Array',False],
    'UNSIGNED_INT'  : ['i',1,4,'Uint32Array',False],
    'FLOAT'         : ['f',1,4,'Float32Array',False],
    # See OpenGL ES 2.0 2.10.4 for why this can be an i32 array.
    'BOOL'          : ['i',1,4,'Int32Array',False],  
    # When queried with getUniform, samplers will return a GLint,
    # which is signed.
    # [0]https://www.khronos.org/registry/webgl/specs/latest/1.0/#5.14.10
    'SAMPLER_2D'    : ['i',1,4,'Int32Array',True],
    'SAMPLER_CUBE'  : ['i',1,4,'Int32Array',True],
}
for k in types:
    types[k].insert(0,k) # insert base type
def pow(signature,n): # Type theoretic exponentiation
    base,kind,nelements,nbytes,constructor,is_sampler = signature
    return [base,kind,nelements*n,nbytes*n,constructor,is_sampler]
# Derived types
types.update({
    'FLOAT_VEC2'  :pow(types['FLOAT'],    2,),
    'FLOAT_VEC3'  :pow(types['FLOAT'],    3),
    'FLOAT_VEC4'  :pow(types['FLOAT'],    4),
    'INT_VEC2'    :pow(types['INT'],      2),
    'INT_VEC3'    :pow(types['INT'],      3),
    'INT_VEC4'    :pow(types['INT'],      4),
    'BOOL_VEC2'   :pow(types['BOOL'],     2),
    'BOOL_VEC3'   :pow(types['BOOL'],     3),
    'BOOL_VEC4'   :pow(types['BOOL'],     4),
}) 
# Derived types from derived types
types.update({
    'FLOAT_MAT2'    :pow(types['FLOAT_VEC2'],    2),
    'FLOAT_MAT3'    :pow(types['FLOAT_VEC3'],    3),
    'FLOAT_MAT4'    :pow(types['FLOAT_VEC4'],    4),
})
def uniform_setter_name(name,signature):
    base,kind,nelements,nbytes,constructor,is_sampler = signature
    if "MAT" in name:
        sqrt_nelements = ({16:4,9:3,4:2})[nelements] # highest mat is mat4
        assert(kind == 'f') # only float matrices
        return f"uniformMatrix{sqrt_nelements}fv"
    if nelements <= 4:
        return f"uniform{nelements}{kind}v"
# Number of attributes taken up when used as a vertex attribute
nattributes = defaultdict(lambda: 1)
nattributes.update({
    'FLOAT_MAT2'    :2,
    'FLOAT_MAT3'    :3,
    'FLOAT_MAT4'    :4,
}) # = 1 if not in this dictionary


# Make output dictionaries
gl_types = {
    code: 
        {
            'name': '"'+names[code]+'"',
            'elementType':  '"'+types[names[code]][0]+'"',
            'nelements':  str(types[names[code]][2]),
            'nattributes':  str(nattributes[names[code]]),
            'nbytes':     str(types[names[code]][3]),
            'TypedArray': str(types[names[code]][4]),
            'uniformv':   '"'+uniform_setter_name(names[code],types[names[code]])+'"',
            'is_sampler': 'true' if types[names[code]][5] else 'false',
        }
    for code in names
}
gl_type_codes = {
    names[code] : code for code in names
}

# generate js file
with open(OUTPUT_FILENAME,'w') as dst:
    # Convert python dict to JS dict
    def jsformat(d,indent=0):
        keys = list(d)
        keys.sort()
        lines = []
        for k in keys:
            if isinstance(d[k],dict):
                lines.append('     '*(indent+1) + k + ":" + jsformat(d[k],indent+1)+',\n')
            else:
                lines.append('    '*(indent+1) + f'{k} : {d[k]},\n')
        return '{\n' + ''.join(lines) + '     '*indent + '}'
    blocks = []
    blocks.append(HEADER)
    blocks.append('export const GL_TYPES = '+jsformat(gl_types))
    blocks.append('export const GL_TYPE_CODES = '+jsformat(gl_type_codes))
    blocks.append('\n')
    dst.write('\n'.join(blocks))

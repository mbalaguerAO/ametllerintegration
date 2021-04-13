const axios = require("axios");

export const setDefaultHeaders = (res) => {
    res.set('Access-Control-Allow-Methods', 'POST, GET')
    res.set('Access-Control-Allow-Credentials', true);
    res.set("Access-Control-Allow-Headers", "Content-Type,*")
    res.set('Cache-Control', 'no-cache')
}

export const getDefaultAddress = () => {
    let defaultAddress = {
        "street": "C/Desconocida 1",
        "postalCode": "08021",
        "city": "Barcelona",
        "state": "Barcelona",
        "country": "es"
    }
    return defaultAddress
}


export const getAjaxDataByGET = async (options) => {
    const response = await axios.get(options.url,{headers:options.headers})
    .catch(function(error){
        return {error}
    });
    if(response && response.data){
        return response.data
    }else if(response && response.error){
        return {error : response.error.response.data}
    }else{
        return false;
    }
}

export const getAjaxData = async (options) => {
    const response = await axios[options.operation](options.url,options.data,{headers:options.headers})
    .catch(function(error){
        //console.log(error);
        return {error}
    });

    if(response && (response.data || response.headers)){
        return response;
    }else if(response && response.error){
        return {error : response.error.response.data}
    }else{
        return false;
    }
}

export const luhn_check = (value) => { 
    return value.split('') .reverse() .map( (x) => parseInt(x, 10) ) .map( (x,idx) => idx % 2 ? x * 2 : x ) .map( (x) => x > 9 ? (x % 10) + 1 : x ) .reduce( (accum, x) => accum += x ) % 10 === 0; 
}

export const check_isAdult = (year, month, day)  => {
  
  let now = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  let dob = year * 10000 + month * 100 + day * 1; // Coerces strings to integers

  return now - dob > 180000;
}

export const formatUserToBaluard = (vtexUserData,vtexAddressData,storeId,storeEndpoint,sendOrigin=false) => {
    if(!vtexAddressData.country){
        vtexAddressData = getDefaultAddress()
    }
    let baluardUserData = <any>{}
    
    let birthdayCast="19691201";
    if((typeof vtexUserData.birthDate != "undefined") ){
        if(vtexUserData.birthDate != null){
            if(vtexUserData.birthDate.length){
                //validar mayoria de edad
                let birthday=vtexUserData.birthDate.split("T");
                let isAdult=false;
                let partOfBirthday=birthday[0].split("-");
                if(partOfBirthday.length > 2){
                    if(check_isAdult(partOfBirthday[0],partOfBirthday[1],partOfBirthday[2])){
                        isAdult=true;
                    }
                }
                if(isAdult){   
                    birthdayCast=birthday[0].replace(/-/gi,"");
                }else{
                    birthdayCast="20011201";
                }    
            }
        } 
    }
    
    baluardUserData = {
        "firstName": vtexUserData.firstName,
        "lastName": vtexUserData.lastName,
        "fiscalId": vtexUserData.document,
        "birthday": birthdayCast, //SE DEJA UNA FECHA FIJA PARA QUE NO DE ERROR, YA QUE NO ESTÁ ESTE CAMPO EN LA WEB
        "contactInfo": {
          "mobilePhone": {
            "prefix": "34",
            "number": (vtexUserData.homePhone?vtexUserData.homePhone:(vtexUserData.phone?vtexUserData.phone:'645555555'))
          },
          "email":  vtexUserData.email,
          "address": {
            "street": vtexAddressData.street,
            "zipCode": vtexAddressData.postalCode,
            "city": vtexAddressData.city,
            "province": (vtexAddressData.state ? vtexAddressData.state : 'Barcelona'),
            "country": ((vtexAddressData.country == 'ESP' || vtexAddressData.country == 'España')?"es":vtexAddressData.country)
          }
        },
        "disableActivationEmail": true,
        //"offline": true, AOV-108 24-04-19, se elimina de nuevo parámetro a petición
        "gender": (vtexUserData.gender?vtexUserData.gender:"female"),
        "password": "unknow",
        "language": (typeof vtexUserData.localeDefault != "undefined" && vtexUserData.localeDefault  && (vtexUserData.localeDefault == 'ca-ES' || vtexUserData.localeDefault.indexOf('ca') >= 0)?'ca':'es'),
        "cardRegistrationStore": {
          "href": `https://${storeEndpoint}/stores/${storeId}`
        },
        "utm" : {
            "campaign" : vtexUserData.campaign,
            "source"   : vtexUserData.source,
            "medium"   : vtexUserData.medium
         }
    }
 
    if(sendOrigin){
        baluardUserData = {
            ...baluardUserData,
            "origin": ((vtexUserData.origin && vtexUserData.origin.length > 0)? vtexUserData.origin : 'vtex')
        }
    }
    if(vtexUserData.claveColectividad && luhn_check(vtexUserData.claveColectividad)){
        baluardUserData['token'] = vtexUserData.claveColectividad
    }
    
    console.log(baluardUserData);
    return baluardUserData;
}
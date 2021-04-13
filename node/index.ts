import { Apps } from '@vtex/api'
import * as parse from 'co-body'
import * as myUtils from './utils/utils'
const axios = require("axios");






export default {
    routes: {
        clientconnection: async (ctx) => {
            var jwtDecode = require('jwt-decode')
            const { request: req, response: res, vtex: ioContext } = ctx
            const { account, authToken } = ioContext
            const apps = new Apps(ctx.vtex)
            const app = process.env.VTEX_APP_ID
            const settings = await apps.getAppSettings(app)
            myUtils.setDefaultHeaders(res)

            if (req.header.origin) {
                if (settings.sandboxSetup.authDomainsCORS) {
                    let corsDomains = settings.sandboxSetup.authDomainsCORS.split(',');
                    if (corsDomains.indexOf(req.header.origin) > -1) {
                        res.set('Access-Control-Allow-Origin', req.header.origin)
                    }
                }
            } else {
                res.set('Access-Control-Allow-Origin', '*')
            }

            let appSecret = settings.baluardSetup.baluardTestKey;
            let storeId = settings.baluardSetup.baluardIDShop
            let sendOrigin = settings.baluardSetup.sendOrigin;
            let vtexAppKey = settings.vtexSetup.vtexAppKey;
            let vtexAppToken = settings.vtexSetup.vtexAppToken;
            let clientEndpoint = `ca-clients-service.herokuapp.com`;
            let storeEndpoint = `ca-stores-service.herokuapp.com`;

            if (settings.baluardSetup.baluardCheck) {
                appSecret = settings.baluardSetup.baluardProdKey
                clientEndpoint = `prod-ca-clients.herokuapp.com`
                storeEndpoint = `prod-ca-stores.herokuapp.com`;
            }

            //https://www.npmjs.com/package/co-body
            const postData = await parse.json(req)
            let postDataObject = null;
            let userId = 0;
            let addressId = 0;
            ctx.response.status = 200

            if (Object.keys(postData).length > 0) {
                postDataObject = postData;
                if (postDataObject.isCustomer) {
                    userId = postDataObject.id;
                } else if (postDataObject.isAddress) {
                    userId = postDataObject.userId
                    addressId = postDataObject.id;
                } else {
                    ctx.response.body = { error: 'No post data' }
                    return
                }
            } else {
                ctx.response.body = { error: 'No post data' }
                return
            }

            //const idToken = ctx.cookies.get('VtexIdclientAutCookie')
            //const idToken = ((req.query && req.query.cookieid)? req.query.cookieid : false );
            //const idToken = ((postData && postData.cookieUser)? postData.cookieUser : false );
            //const userEmail = ((userData && userData.sub)? userData.sub : false );
            //let urlSearchUser = `http://api.vtex.com/${account}/dataentities/CL/search?_fields=_all&_where=userId=${userId}`
            let urlSearchAddress = '';
            if (addressId > 0) {
                urlSearchAddress = `https://${account}.vtexcommercestable.com.br/api/dataentities/AD/documents/${addressId}`
            } else {
                urlSearchAddress = `https://${account}.vtexcommercestable.com.br/api/dataentities/AD/search?_fields=_all&_where=userId=${userId}`
            }
            let urlVtexUser = `https://${account}.vtexcommercestable.com.br/api/dataentities/CL/documents/${userId}`

            var responseBodyData = {
                dateOperation: new Date().toISOString().replace(/\..+/, '+00:00'),
                errorSearchBaluard: '',
                errorCreateBaluard: '',
                errorUpdateBaluard: '',
                errorUpdateVTEX: '',
                generalStatus: ''
            }

            let optionsGetUser = {
                url: urlVtexUser + '?_fields=_all',
                headers: {
                    'Proxy-Authorization': authToken,
                    'X-Vtex-Proxy-To': `https://api.vtex.com`,
                    'x-vtex-api-appkey': vtexAppKey,
                    'x-vtex-api-apptoken': vtexAppToken
                }
            }

            let userVtexData = await myUtils.getAjaxDataByGET(optionsGetUser);
            if (!userVtexData.id) {
                ctx.response.body = { error: 'No VTEX user found' }
                return
            }
            if (!userVtexData.document) {
                ctx.response.body = { error: 'VTEX user not have DNI' }
                return
            }

            let optionsGetAddress = optionsGetUser;
            optionsGetAddress.url = urlSearchAddress;

            let addressVtexData = await myUtils.getAjaxDataByGET(optionsGetAddress);

            let urlSearchUserBaluard = `http://${clientEndpoint}/club/${userVtexData.externalUserId}`
            if (!userVtexData.externalUserId) {
                urlSearchUserBaluard = `http://${clientEndpoint}/club/fiscal-id/${userVtexData.document}`
            }

            //Al final siempre hay que buscar por el DNI, asi que no vamos a buscar por el ID que le corresponde en Baluard, para evitar males... (las líneas anteriores)
            urlSearchUserBaluard = `http://${clientEndpoint}/club/fiscal-id/${userVtexData.document}`

            //Esto serviria para buscar por email, pero lo dejamos comentado ya que solo debemos buscar por DNI
            /*
            if(!userVtexData.document && userVtexData.email){
                urlSearchUserBaluard = `http://${clientEndpoint}/club/email/${userVtexData.email}`
            }
            */

            let optionsSearchBaluardUser = {
                url: urlSearchUserBaluard,
                headers: {
                    'Authorization': `Bearer ${appSecret}`,
                    //'VtexIdclientAutCookie': authToken,
                    'Proxy-Authorization': authToken,
                    'X-Vtex-Proxy-To': `https://${clientEndpoint}`,
                    'x-vtex-api-appkey': vtexAppKey,
                    'x-vtex-api-apptoken': vtexAppToken
                },
            }

            let responseBaluard = await myUtils.getAjaxDataByGET(optionsSearchBaluardUser)

            let createOp = false;
            let opURLBaluard = `http://${clientEndpoint}/club`;

            //Si el usuario no se encuentra en Baluard, debemos crearlo
            if (responseBaluard.error) {
                responseBodyData.errorSearchBaluard = responseBaluard.error
                createOp = true;
            } else {
                opURLBaluard = responseBaluard.href.replace('https', 'http');
            }

            let optionsCreateUpdateUser = {
                url: opURLBaluard,
                headers: {
                    'Authorization': `Bearer ${appSecret}`,
                    //'VtexIdclientAutCookie': authToken,
                    'Proxy-Authorization': authToken,
                    'X-Vtex-Proxy-To': `https://${clientEndpoint}`,
                    'x-vtex-api-appkey': vtexAppKey,
                    'x-vtex-api-apptoken': vtexAppToken
                },
                data: myUtils.formatUserToBaluard(userVtexData, ((addressId > 0) ? addressVtexData : addressVtexData[0]), storeId, storeEndpoint, sendOrigin),
                operation: "post"
            }

            let response = null;
            if (createOp) {
                //CREAR USUARIO
                response = await myUtils.getAjaxData(optionsCreateUpdateUser);
            } else {
                //ACTUALIZAR USUARIO
                optionsCreateUpdateUser.operation = "put"
                response = await myUtils.getAjaxData(optionsCreateUpdateUser);
            }

            if (response.headers) {
                if (response.status == 201 && response.headers.location) {
                    optionsSearchBaluardUser.url = response.headers.location
                    responseBodyData.generalStatus = `Successful Baluard creation on ${response.headers.location}`
                } else if (response.status == 204) {
                    responseBodyData.generalStatus = `Successful Baluard update on ${optionsCreateUpdateUser.url}`
                    optionsSearchBaluardUser.url = optionsCreateUpdateUser.url
                }
                //Hacemos una última petición de los datos a baluard tras actualización o insercción para dejar en VTEX los mismos datos
                responseBaluard = await myUtils.getAjaxDataByGET(optionsSearchBaluardUser)
            } else {
                responseBodyData.generalStatus = `Error on ${(createOp ? 'POST (Create)' : 'PUT (Update)')} to Baluard`
                if (createOp) {
                    responseBodyData.errorCreateBaluard = response.error
                } else {
                    responseBodyData.errorUpdateBaluard = response.error
                }
            }

            let updateUserData = <any>{};

            //Si hemos podido recuperar en algún momento el usuario de Baluard, intentamos modificarlo en VTEX
            if (responseBaluard.error || !responseBaluard) {
                responseBodyData.generalStatus += '. But cannot recover user, so not updated VTEX info :('
            } else {
                responseBodyData.generalStatus += '. Found Baluard user'
                updateUserData = {
                    "firstName": responseBaluard.firstName,
                    "lastName": responseBaluard.lastName,
                    "multiplierColectividad": (responseBaluard.groupInfo && responseBaluard.groupInfo.multiplier) ? responseBaluard.groupInfo.multiplier : 0,
                    "groupInfoJSON": (responseBaluard.groupInfo) ? JSON.stringify(responseBaluard.groupInfo) : "",
                    "groupInfoName": (responseBaluard.groupInfo && responseBaluard.groupInfo.name) ? responseBaluard.groupInfo.name : "",
                    "externalUserId": responseBaluard.href.replace(`https://${clientEndpoint}/club/`, ""),
                }
            }

            //Intentar guardar el status de integración de nuevo en caso de errores...
            updateUserData = {
                ...updateUserData,
                "statusIntegration": JSON.stringify(responseBodyData, null, 2),
                "lastAmetllerIntegrationTriggerDate": responseBodyData.dateOperation
            }
            if(( (userVtexData.preexistenteBaluard && userVtexData.preexistenteBaluard.length == 0) || !userVtexData.preexistenteBaluard)
                && responseBodyData.errorCreateBaluard.length == 0){
                updateUserData = {
                    ...updateUserData,
                    "preexistenteBaluard" : ( createOp ? "0" : "1")
                }
            }
            let optionsUpdateVTEXUser = {
                url: urlVtexUser,
                headers: {
                    'Proxy-Authorization': authToken,
                    'X-Vtex-Proxy-To': `https://api.vtex.com`,
                    'x-vtex-api-appkey': vtexAppKey,
                    'x-vtex-api-apptoken': vtexAppToken
                },
                operation: "patch",
                data: updateUserData
            }
            let responseVTEXUpdate = await myUtils.getAjaxData(optionsUpdateVTEXUser)

            if (responseVTEXUpdate.error || !responseVTEXUpdate) {
                responseBodyData.generalStatus += '. But not updated VTEX info :('
                responseBodyData.errorUpdateVTEX = responseVTEXUpdate.error
            } else {
                responseBodyData.generalStatus += '. Successful VTEX update :)'
            }

            ctx.response.body = responseBodyData
        }
    }
}

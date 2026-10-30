// Actual role handlers, gate, OTP clients and Customer CSRF wrapper. Only transport,
// routing and unrelated presentation/address/map controls are synthetic.
export function registrationRoleModules(compile) {
  const react = "const React=require('react');"
  const fields = `${react}
    function Input({label,error,hint,leadingIcon,trailingElement,...props}) {
      return React.createElement('label',null,label,React.createElement('input',{...props,className:'mt-2 min-h-12 w-full border rounded-lg px-3'}));
    }
    function Select({label,error,hint,...props}) {
      return React.createElement('label',null,label,React.createElement('select',{...props,className:'mt-2 min-h-12 w-full border rounded-lg px-3'}));
    }
    module.exports={TextField:Input,Field:Input,FormField:Input,SelectField:Select,
      Button:({isLoading,loadingLabel,...props})=>React.createElement('button',{...props,disabled:props.disabled||isLoading},isLoading?loadingLabel:props.children)};`
  const api = `class ApiError extends Error {
    constructor(status,payload){super(payload.message);this.status=status;this.errors=payload.errors||{};this.code=payload.code;}
  }
  module.exports={ApiError,initializeCsrf:signal=>window.csrf(signal),csrf:()=>window.csrf(),
    apiRequest:(path,options)=>window.transport(path,options),request:(path,options)=>window.transport(path,options),
    firstFieldError:(error,key)=>error?.errors?.[key]?.[0]};`
  return {
    './register-customer': compile('src/webapp/src/components/auth/register-form.tsx'),
    './register-seller': compile('src/seller/src/pages/RegisterPage.tsx'),
    './register-logistics': compile('src/logistics/src/pages/RegisterPage.tsx').replaceAll('import.meta.env', '({})'),
    './email-customer': compile('src/webapp/src/lib/registration-email.ts'),
    './email-seller': compile('src/seller/src/lib/registration-email.ts'),
    './email-logistics': compile('src/logistics/src/lib/registration-email.ts'),
    '@/lib/customer-auth': compile('src/webapp/src/lib/customer-auth.ts'),
    '@aisley/ui': fields,
    './fields': fields,
    '../components/FormField': "module.exports=require('./fields')",
    '../components/Field': "module.exports=require('./fields')",
    './api': api,
    '@/lib/api': "module.exports=require('./api')",
    '../lib/api': "module.exports=require('./api')",
    '../lib/registration-email': `module.exports={registrationEmailClient:{
      getConfig:(...args)=>require('./email-'+window.role).registrationEmailClient.getConfig(...args),
      requestCode:(...args)=>require('./email-'+window.role).registrationEmailClient.requestCode(...args),
      verifyCode:(...args)=>require('./email-'+window.role).registrationEmailClient.verifyCode(...args)}};`,
    '@/lib/registration-email': "module.exports=require('../lib/registration-email')",
    '@aisley/ui/registration-email': `${react}
      const Gate=require('./gate').RegistrationEmailGate;
      module.exports={RegistrationEmailGate:props=>React.createElement(Gate,{...props,children:verification=>{
        window.verification=verification;
        return props.children({...verification,beginSubmission:()=>{
          const attempt=verification.beginSubmission();if(attempt)window.attempts.push(attempt);return attempt;
        }});
      }})};`,
    'next/navigation': "module.exports={useRouter:()=>({push:path=>window.navigations.push({path})})}",
    'react-router-dom': `${react}module.exports={Link:({to,children})=>React.createElement('a',{href:to},children),
      Navigate:()=>null,useNavigate:()=>(path,options)=>window.navigations.push({path,options})};`,
    '../auth/useAuth': "module.exports={useAuth:()=>({seller:null,isLoading:false})}",
    '../components/AuthShell': `${react}module.exports={AuthShell:({children,footer})=>React.createElement('div',null,children,footer)};`,
    '../components/PsgcAddressFields': `${react}const {Field}=require('./fields');
      module.exports={PsgcAddressFields:()=>React.createElement('div',null,
        ...['region','province','city_municipality','barangay','address_line_1','postal_code'].map(name=>
          React.createElement(Field,{key:name,name:'address['+name+']',label:name,defaultValue:'Fixture',required:true})))};`,
    '../components/FlatpickrInput': `${react}const {Field}=require('./fields');
      module.exports={FlatpickrField:({options,onChange,...props})=>React.createElement(Field,{...props,type:'date',onChange:event=>onChange(event.target.value)})};`,
    '../components/HubLocationPicker': `${react}module.exports={HubLocationPicker:()=>React.createElement('p',null,'Synthetic map')};`,
    './form-alert': compile('src/webapp/src/components/auth/form-alert.tsx'),
    './password-field': compile('src/webapp/src/components/auth/password-field.tsx'),
    'react-icons/fi': `${react}module.exports=Object.fromEntries(['FiArrowRight','FiCalendar','FiMail','FiPhone','FiUser','FiEye','FiEyeOff','FiLock','FiAlertCircle','FiCheckCircle'].map(name=>[name,()=>React.createElement('span')]));`,
    'react-icons/fa6': `${react}module.exports={FaCircleCheck:()=>null,FaCircleExclamation:()=>null};`,
  }
}

export function registrationRoleSource(modules) {
  // Source loaded inside an IIFE to coexist with the earlier shared-gate fixture.
  return `(() => {
    const process={env:{NODE_ENV:'production'}},sources=${JSON.stringify(modules)},cache={};
    function require(name){
      if(cache[name])return cache[name].exports;
      if(!sources[name])throw Error('Missing module '+name);
      const module={exports:{}};cache[name]=module;
      new Function('module','exports','require',sources[name])(module,module.exports,require);return module.exports;
    }
    const React=require('react'),{flushSync}=require('react-dom');
    const root=require('react-dom/client').createRoot(document.getElementById('role-root'));
    window.csrf=async()=>{
      if(window.delayCsrf)await new Promise(resolve=>window.csrfQueue.push(resolve));
    };
    window.transport=async(path,options={})=>{
      if(path.endsWith('/registration-options'))return {shop_categories:[{id:'category',name:'Fixture category'}]};
      const body=options.body instanceof FormData?Object.fromEntries(options.body):JSON.parse(options.body||'{}');
      if(path.endsWith('/registration/config')) {if(window.configFailure)throw Error('Settings unavailable');return {email_verification_required:window.otpRequired!==false};}
      if(path.endsWith('/verification-code'))return {challenge_id:'11111111-1111-4111-8111-111111111111',
        expires_at:new Date(Date.now()+600000).toISOString(),resend_available_at:new Date(Date.now()+60000).toISOString()};
      if(path.endsWith('/verify-email'))return {email_verification_token:(body.email.startsWith('first')?'a':'b').repeat(64),
        expires_at:new Date(Date.now()+3600000).toISOString()};
      if(!path.endsWith('/register'))throw Error('Unexpected path '+path);
      // Intentionally ignore abort: cancellation cannot undo a server commit.
      return new Promise((resolve,reject)=>window.finalQueue.push({body,signal:options.signal,resolve,reject}));
    };
    window.mountRole=role=>{
      window.role=role;window.offset=0;window.attempts=[];window.finalQueue=[];window.csrfQueue=[];
      window.delayCsrf=false;window.navigations=[];
      const entry=require('./register-'+role),Component=role==='customer'?entry.RegisterForm:entry.RegisterPage;
      flushSync(()=>root.render(React.createElement(Component,{key:++window.sequence})));
    };
    window.unmountRole=()=>flushSync(()=>root.render(null));
    window.resolveFinal=(index=0,status='pending')=>{
      const item=window.finalQueue[index];
      item.resolve({message:'Registration submitted for approval.',seller:{email:item.body.email},customer:{email:item.body.email,status}});
    };
    window.rejectFinal=(kind,index=0)=>{
      const {ApiError}=require('./api');
      window.finalQueue[index].reject(kind==='proof'
        ?new ApiError(422,{message:'Email proof rejected.',errors:{email_verification_token:['Email proof rejected.']}})
        :kind==='validation'?new ApiError(422,{message:'Correct your first name.',errors:{first_name:['Required.']}})
        :kind==='cancel'?new DOMException('Upload cancelled','AbortError')
        :new ApiError(503,{message:'Service unavailable.'}));
    };
  })();`
}

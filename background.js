var defaultRgx =  ["<all_urls>","*://*/*","https://*.w3schools.com/*"].join('\n')
var theRegex = null;
var headersdo = {
		"content-security-policy":(x=>{return false}),
		"x-frame-options":(x=>{return false})
	}

function updateRegexpes()
{
	browser.storage.local.get(null, function(res) {
		var  regstr = (res.regstr_allowed || defaultRgx);
		browser.webRequest.onHeadersReceived.removeListener(setHeader)
		if(!res.is_disabled)
		{
			theRegex = new RegExp(
				regstr.split("\n").map(
					x=>x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')	// Sanitize regex
						.replace(/(^<all_urls>|\\\*)/g,"(.*?)")	// Allow wildcards
						.replace(/^(.*)$/g,"^$1$")).join("|")	// User multi match
				)
			browser.webRequest.onHeadersReceived.addListener(
				setHeader,
				{urls :["<all_urls>"], types:["sub_frame","object"]},
				["blocking", "responseHeaders"]
			);
		}
	});
}

function setHeader(e) {
	return new Promise((resolve, reject)=>
	{
		(e.tabId == -1
			?new Promise(resolve=>resolve({url:e.originUrl}))
			:browser.webNavigation.getFrame({tabId:e.tabId,frameId:e.parentFrameId})
		).then(parentFrame=>{
			if(parentFrame.url.match(theRegex))
			{
				e.responseHeaders=e.responseHeaders.filter(x=>(headersdo[x.name.toLowerCase()]||Array)())
			}
		  	resolve({responseHeaders: e.responseHeaders});
		})
	})
}
updateRegexpes();
var portFromCS;
function connected(p) {
	portFromCS = p;
	portFromCS.onMessage.addListener(function(m) {
			browser.storage.local.set(m,updateRegexpes);
	});
}
browser.runtime.onConnect.addListener(connected);
console.log("LOADED");

customElements.define('x-frame-bypass', class extends HTMLIFrameElement {
	static get observedAttributes() {
		return ['src']
	}
	constructor () {
		super()
	}
	attributeChangedCallback () {
		this.load(this.src)
	}
	connectedCallback () {
		this.sandbox = '' + this.sandbox || 'allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation' // all except allow-top-navigation
	}
	load (url, options) {
		if (!url || !url.startsWith('http'))
			throw new Error(`X-Frame-Bypass src ${url} does not start with http(s)://`)
		console.log('X-Frame-Bypass loading:', url)
		this.srcdoc = `<html>
<head>
	<style>
	.loader {
		position: absolute;
		top: calc(50% - 25px);
		left: calc(50% - 25px);
		width: 50px;
		height: 50px;
		background-color: #333;
		border-radius: 50%;  
		animation: loader 1s infinite ease-in-out;
	}
	@keyframes loader {
		0% {
		transform: scale(0);
		}
		100% {
		transform: scale(1);
		opacity: 0;
		}
	}
	</style>
</head>
<body>
	<div class="loader"></div>
</body>
</html>`
		this.fetchProxy(url, options, 0).then(res => res.text()).then(data => {
			if (data)
				this.srcdoc = data.replace(/<head([^>]*)>/i, `<head$1>
	<base href="${url}">
	<script>
	// X-Frame-Bypass navigation event handlers
	document.addEventListener('click', e => {
		if (frameElement && document.activeElement && document.activeElement.href) {
			e.preventDefault()
			frameElement.load(document.activeElement.href)
		}
	})
	document.addEventListener('submit', e => {
		if (frameElement && document.activeElement && document.activeElement.form && document.activeElement.form.action) {
			e.preventDefault()
			if (document.activeElement.form.method === 'post')
				frameElement.load(document.activeElement.form.action, {method: 'post', body: new FormData(document.activeElement.form)})
			else
				frameElement.load(document.activeElement.form.action + '?' + new URLSearchParams(new FormData(document.activeElement.form)))
		}
	})
	</script>`)
		}).catch(e => console.error('Cannot load X-Frame-Bypass:', e))
	}
	fetchProxy (url, options, i) {
		const proxies = (options || {}).proxies || [
			'https://cors-anywhere.herokuapp.com/',
			'https://yacdn.org/proxy/',
			'https://api.codetabs.com/v1/proxy/?quest='
		]
		return fetch(proxies[i] + url, options).then(res => {
			if (!res.ok)
				throw new Error(`${res.status} ${res.statusText}`);
			return res
		}).catch(error => {
			if (i === proxies.length - 1)
				throw error
			return this.fetchProxy(url, options, i + 1)
		})
	}
}, {extends: 'iframe'})
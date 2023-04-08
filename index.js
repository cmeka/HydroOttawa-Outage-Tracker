const fs = require('fs').promises;
const { executablePath } = require('puppeteer');
const puppeteer = require('puppeteer-extra');
const { intercept, patterns } = require('puppeteer-interceptor');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
// const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
// puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

(async () => {

	function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	const fileExists = async path => !!(await fs.stat(path).catch(e => false));

	let browser = await puppeteer.launch({
		ignoreHTTPSErrors: true,
		headless: true, // set to false if you want to see it in action
		executablePath: executablePath(),
		// executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		args: [
			'--window-size=1920,1080',
			// '--window-size=2560,1440',
			'--window-position=000,000',
			'--disable-dev-shm-usage',
			'--no-sandbox',
			'--use-gl=angle',
			// '--use-gl=swiftshader',
			// '--disable-gpu',
			'--disable-web-security',
			'--disable-features=site-per-process',
			'--allow-file-access-from-files',
		],
	});

	let page = await browser.newPage();
	await page.setViewport({
		width: 1920,
		height: 1080,
		deviceScaleFactor: 2,
	});

	// Insercept main outage page and modify the map colour values
	await intercept(page, patterns.Document('*'), {
		onInterception: event => {
			// console.log(`${event.request.url} intercepted.`);
		},
		onResponseReceived: event => {
			if (event.request.url === "https://outages.hydroottawa.com/") {
				console.log(`${event.request.url} intercepted, modifying javascript`);
				event.response.body = event.response.body.replace('"property": "CAUSE_CODE",', '"property": "STATUS",');
				event.response.body = event.response.body.replace('"stops": [["Scheduled Outage", "#00FFFF"]],', '"stops": [["Dispatched", "#FF9900"],["On Route", "#FFFF00"],["Crew Arrived", "#00FFFF"]],');
			}
			return event.response;
		}
	});
	 
	// Intercept json request, not required anymore with fetching externally
	/*
	page.on('response', async(response) => {
		const request = response.request();
		if (request.url().includes('outage_polygons_public.json')) {
			console.log(new Date().toLocaleString(), 'Found', request.url());
			try {
				let currOttawa = await response.text();
				let currOttawaJSON = JSON.parse(currOttawa);
				let json = processData(currOttawaJSON);
				updateMap(json);
			} catch (err) {
				console.error(err);
			}
		} else {
			// console.log(request.url());
		}
	});
	*/

	// Process outage json and return stats
	function processData(currOttawaJSON){
		let totalOutagesCust = 0, totalStatusPending = 0, totalStatusArrived = 0, totalStatusOnRoute = 0, totalStatusDispatched = 0;
		let totalOutagesAreas = currOttawaJSON.features.length;
		currOttawaJSON.features.forEach(function(f){
			totalOutagesCust = totalOutagesCust + parseInt(f.properties.OUTAGE_CUSTOMERS);
			if (f.properties.STATUS === "Pending") totalStatusPending++;
			if (f.properties.STATUS === "Dispatched") totalStatusDispatched++;
			if (f.properties.STATUS === "On Route") totalStatusOnRoute++;
			if (f.properties.STATUS === "Crew Arrived") totalStatusArrived++;
		});
		// console.log('Total customer outages:', totalOutagesCust);
		// console.log('Total outage areas:', totalOutagesAreas);
		// console.log('Total Status Pending:', totalStatusPending);
		// console.log('Total Status Dispatched:', totalStatusDispatched);
		// console.log('Total Status On Route:', totalStatusOnRoute);
		// console.log('Total Status Crew Arrived:', totalStatusArrived);
		currOttawaInfo = {
			'cust': totalOutagesCust,
			'areas': totalOutagesAreas,
			'pending': totalStatusPending,
			'dispatched': totalStatusDispatched,
			'onroute': totalStatusOnRoute,
			'crewarrived': totalStatusArrived,
		};
		return currOttawaInfo;
	}

	async function updateMap(json, filestats, imgpath){
		try {
			currOttawaInfo = processData(json);

			await page.evaluate((outage_data, file_stats, outage_stats) => {
				try {
					if (file_stats) info.last_modify_update(file_stats.mtime);
					map.getSource('outage-polygons').setData(outage_data);
					// displayOutagePolygons(outage_data);
					// [["Dispatched", "#FF9900"],["On Route", "#FFFF00"],["Crew Arrived", "#00FFFF"]],');
					document.getElementById('summary-label').innerHTML = `Total Customer Outages: ${outage_stats.cust}<br>Total Areas: ${outage_stats.areas}<br><span style="color:#FF0000;font-weight:900">&#x2022;</span> Pending: ${outage_stats.pending}<br><span style="color:#FF9900;font-weight:900">&#x2022;</span> Dispatched: ${outage_stats.dispatched}<br><span style="color:#FFFF00;font-weight:900">&#x2022;</span> On Route: ${outage_stats.onroute}<br><span style="color:#00FFFF;font-weight:900;font-weight:900">&#x2022;</span> Crew Arrived: ${outage_stats.crewarrived}`;
					document.getElementById('ward').style.display = 'none';
					document.getElementsByClassName('mapboxgl-ctrl-top-left')[0].style.visibility = 'hidden';
				} catch (e) { }
			}, json, filestats, currOttawaInfo);

			// console.log(new Date().toLocaleString(), 'Change detected, taking screenshot..');
			if (imgpath){
				await sleep(100);
				await page.screenshot({ path: imgpath, type: 'jpeg', quality: 90, fullPage: true });
			}
			// console.log(new Date().toLocaleString(), 'Screenshot taken.');
		} catch (err) {
			console.error(err);
		}
	}

	// Load and setup outage site
	console.log(new Date().toLocaleString(), 'Page loading..');
	await page.goto('https://outages.hydroottawa.com/', { waitUntil: 'networkidle2' });
	console.log(new Date().toLocaleString(), 'Page loaded.');
	await page.waitForSelector('button.mapboxgl-ctrl-zoom-out');
	let zoom = await page.$('button.mapboxgl-ctrl-zoom-out');
	for (let i = 0; i < 7; i++) await zoom.click({ delay: 200 });

	// Fetch json files list
	let json_path = '.\\outages';
	let files = await fs.readdir(json_path);

	// Iterate through files and run updateMap
	for (const file of files) {
		let json = JSON.parse(await fs.readFile(json_path + '/' + file));
		let stats = await fs.stat(json_path + '/' + file);

		let datetime = stats.mtime.toISOString().replace(/:/g, '-').replace('T', '_').replace(/\..*/, '');
		let imgpath = `screenshots/${datetime}.jpg`;

		let imgExists = await fileExists(imgpath);
		if (!imgExists) {
			console.log(`Running ${datetime}.jpg`);
			await updateMap(json, stats, imgpath);
			await sleep(400);
		}
	}

	/* Single test */
	// let json = JSON.parse(await fs.readFile(json_path + '/' + '2023-04-05_10-35-01.json'));
	// let stats = await fs.stat(json_path + '/' + '2023-04-05_10-35-01.json');
	// await updateMap(json, stats);

	//Exit => CTRL+C
	process.on('SIGINT', async () => {
		console.log("Exiting.");
		await browser.close();
		process.exit();
	});
	
})();
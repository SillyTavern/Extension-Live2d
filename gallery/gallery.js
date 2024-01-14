export{
    startSelectDialog,
};

import{
    getAssetsLive2dFiles,
    onModelChange,
} from '../ui.js';

function getImagePath(modelpath) {
    let folderPath = modelpath.replace(/^\.\.\//, '');
    if (folderPath.includes('model3.json')) {
        folderPath = folderPath.replace('.model3.json', '_thumbnail.png');
    } else if (folderPath.includes('model.json')) {
        folderPath = folderPath.replace('model.json', '_thumbnail.png');
    }
    return folderPath;
}

function getTags(modelpath) {
    return new Promise((resolve, reject) => {
        let tags = [];
        let folderPath = modelpath.replace(/^\.\.\//, '');
        if (folderPath.includes('model3.json')) {
            folderPath = folderPath.replace('.model3.json', '.tags');
        } else if (folderPath.includes('model.json')) {
            folderPath = folderPath.replace('model.json', '.tags');
        }

        fetch(folderPath)
            .then(res => res.text())
            .then(text => {
                let t = text;
                t = t.replace(/[\[\]\/\\" ]/g, '');
                t = t.replace(/[-_]/g, '');
                tags = t.split(',');
                resolve(tags);
            })
            .catch(err => {
                console.log('Error while getting tags of: ['+ modelpath +'] - ' + err);
                resolve(tags); // if failed no tags are returned
            });
    });
}

async function showThumbnails(models){
    const galleryDiv = document.getElementById('live2D-dialog-gallery');
    galleryDiv.innerHTML = '';

    for (const model of models){
        let imagePath = getImagePath(model.model);
        const imageDiv = document.createElement('div');
        imageDiv.classList.add('img-container');

        const image = document.createElement('img');
        image.onerror = function() {
            this.src = 'scripts/extensions/third-party/Extension-Live2d/gallery/noimage.png'; // Placeholder image
        };
        image.src = imagePath;
        image.classList.add('img-fluid', 'rounded');

        const overlay = document.createElement('div');
        overlay.classList.add('overlay');
        overlay.textContent = model.name;

        imageDiv.appendChild(image);
        imageDiv.appendChild(overlay);
        galleryDiv.appendChild(imageDiv);

        imageDiv.addEventListener('click', () => {
            console.log(model.model);
            onModelChange(null, model.model);
        });
    }
}

async function get_live2d_model(filter) {
    let live2d_models = [];
    const assets = await getAssetsLive2dFiles();

    console.log('FILTER', filter);
    console.log('found models');
    for (const entry of assets['live2d']) {
        let skip = false;
        // check if searchfilter is set
        if(filter.text){
            if(!entry.toLowerCase().includes(filter.text.toLowerCase()))
                continue;
        }

        let folder = entry.replace('assets\\live2d\\','').replaceAll('\\', '/');
        let name = folder.substring(folder.lastIndexOf('/') + 1);
        folder = folder.substring(0, folder.lastIndexOf('/') + 1);

        // check if tagfilter is set
        if(filter.tags){
            let SearchString = filter.tags.toLowerCase();
            SearchString = SearchString.replace()
            SearchString = SearchString.replace(/[\[\]\/\\" ]/g, '');
            SearchString = SearchString.replace(/[-_]/g, '');
            let searchTags = SearchString.split(',');
            let tags = await getTags(entry);
            for(const stag of searchTags){
                if(!tags.includes(stag)){
                    skip = true;
                    break;
                }
            }
        }
        if(skip) continue;

        let modelInfo = {
            'folder' : folder,
            'model' : entry,
            'name': name,
        };
        live2d_models.push(modelInfo);
    }

    showThumbnails(live2d_models);
}

function checkFilter() {
    let input = '';
    // if ($('#live2d_sex_select').val())
    //     input += ',' + $('#live2d_sex_select').val();
    if ($('#live2d_eyecolor_select').val())
        input += ',' + $('#live2d_eyecolor_select').val();
    if ($('#live2d_haircolor_select').val())
        input += ',' + $('#live2d_haircolor_select').val();
    if ($('#live2d_hairlength_select').val())
        input += ',' + $('#live2d_hairlength_select').val() ;
    if ($('#live2d_breastsize_select').val())
        input += ',' + $('#live2d_breastsize_select').val();
    if ($('#live2D-tag-filter').val())
        input += ',' + $('#live2D-tag-filter').val();

    return input.substring(1);
}

async function applyFilter(){
    let filter = {
        'text' : '',
        'tags' : '',
    };

    filter.tags = checkFilter();
    filter.text = $('#live2D-text-filter').val();
    get_live2d_model(filter);
}

async function startSelectDialog(data){
    document.body.insertAdjacentHTML('afterbegin', data);
    let settings = document.getElementById('live2d_settings');
    let dlg = document.getElementById('live2D-SelectDialog');
    let popup = document.getElementById('live2d-popup');
    let timer;
    const debounceTime = 1000; // 1 second
    let filter = {
        'text' : '',
        'tags' : '',
    };

    // populate filter
    // for now hard coded
    // $('#live2d_sex_select').append(new Option('any', ''));
    // $('#live2d_sex_select').append(new Option('M', '1boy'));
    // $('#live2d_sex_select').append(new Option('F', '1girl'));
    // $('#live2d_sex_select').trigger('change');

    $('#live2d_eyecolor_select').append(new Option('any', ''));
    $('#live2d_eyecolor_select').append(new Option('brown', 'browneyes'));
    $('#live2d_eyecolor_select').append(new Option('blue', 'blueeyes'));
    $('#live2d_eyecolor_select').append(new Option('red', 'redeyes'));
    $('#live2d_eyecolor_select').append(new Option('green', 'greeneyes'));
    $('#live2d_eyecolor_select').append(new Option('yellow', 'yelloweyes'));
    $('#live2d_eyecolor_select').append(new Option('orange', 'orangeeyes'));
    $('#live2d_eyecolor_select').append(new Option('purple', 'purpleeyes'));
    $('#live2d_eyecolor_select').append(new Option('pink', 'pinkeyes'));
    $('#live2d_eyecolor_select').append(new Option('black', 'blackeyes'));
    $('#live2d_eyecolor_select').append(new Option('gray', 'grayeyes'));
    $('#live2d_eyecolor_select').trigger('change');

    $('#live2d_haircolor_select').append(new Option('any', ''));
    $('#live2d_haircolor_select').append(new Option('brown', 'brownhair'));
    $('#live2d_haircolor_select').append(new Option('blue', 'bluehair'));
    $('#live2d_haircolor_select').append(new Option('red', 'redhair'));
    $('#live2d_haircolor_select').append(new Option('green', 'greenhair'));
    $('#live2d_haircolor_select').append(new Option('yellow', 'yellowhair'));
    $('#live2d_haircolor_select').append(new Option('orange', 'orangehair'));
    $('#live2d_haircolor_select').append(new Option('purple', 'purplehair'));
    $('#live2d_haircolor_select').append(new Option('pink', 'pinkhair'));
    $('#live2d_haircolor_select').append(new Option('black', 'blackhair'));
    $('#live2d_haircolor_select').append(new Option('gray', 'grayhair'));
    $('#live2d_haircolor_select').append(new Option('white', 'whitehair'));
    $('#live2d_haircolor_select').trigger('change');

    $('#live2d_hairlength_select').append(new Option('any', ''));
    $('#live2d_hairlength_select').append(new Option('short', 'shorthair'));
    $('#live2d_hairlength_select').append(new Option('long', 'longhair'));
    $('#live2d_hairlength_select').append(new Option('very long', 'verylonghair'));
    $('#live2d_hairlength_select').trigger('change');

    $('#live2d_breastsize_select').append(new Option('any', ''));
    $('#live2d_breastsize_select').append(new Option('small', 'smallbreasts'));
    $('#live2d_breastsize_select').append(new Option('medium', 'mediumbreasts'));
    $('#live2d_breastsize_select').append(new Option('large', 'largebreasts'));
    $('#live2d_breastsize_select').trigger('change');

    // Eventlistener
    // - closing the Dialog by btn
    $('#live2D-dialog-btn-close').on('click', () => {
        document.body.removeChild(dlg);
    });

    // - closing the Dialog by clicking outside of it
    dlg.addEventListener('click', function(event) {
        settings.click();
        if(!popup.contains(event.target))
            document.body.removeChild(dlg);
    });

    // - reseting all filters
    $('#live2D-no-filter').on('click', () => {
        $('#live2D-text-filter').val('');
        $('#live2D-tag-filter').val('');
        $('#live2d_sex_select').val('');
        $('#live2d_eyecolor_select').val('');
        $('#live2d_haircolor_select').val('');
        $('#live2d_hairlength_select').val('');
        $('#live2d_breastsize_select').val('');

        filter.text = '';
        filter.tags = '';
        get_live2d_model(filter);
    });

    // - setting filter
    $('#live2d_sex_select').on('change', applyFilter);
    $('#live2d_eyecolor_select').on('change', applyFilter);
    $('#live2d_haircolor_select').on('change', applyFilter);
    $('#live2d_hairlength_select').on('change', applyFilter);
    $('#live2d_breastsize_select').on('change', applyFilter);

    // - setting the search-string filter for path and name
    $('#live2D-text-filter').on('input', function() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            applyFilter();
        }, debounceTime);
    });

    // - setting the search-string filter for tags
    $('#live2D-tag-filter').on('input', function() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            applyFilter();
        }, debounceTime);
    });

    get_live2d_model(filter);
}


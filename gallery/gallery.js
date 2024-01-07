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
    })

    // - reseting all filters
    $('#live2D-no-filter').on('click', () => {
        $('#live2D-text-filter').val('');

        filter.text = '';
        filter.tags = '';
        get_live2d_model(filter);
    });

    // - setting the search-string filter for path and name
    $('#live2D-text-filter').on('input', function() {
        const input = $(this).val();
        clearTimeout(timer);
        timer = setTimeout(() => {
            filter.text = input;
            get_live2d_model(filter);
        }, debounceTime);
    });

    // - setting the search-string filter for tags
    $('#live2D-tag-filter').on('input', function() {
        const input = $(this).val();
        clearTimeout(timer);
        timer = setTimeout(() => {
            filter.tags = input;
            get_live2d_model(filter);
        }, debounceTime);
    });

    get_live2d_model(filter);
}


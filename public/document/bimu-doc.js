
// upload file
$.ajax({
    type: 'GET',
    url: baseUrl + "/channels/" + selectedChannelId + "/attachments/upload?ext=" + extension,
    success: function (uploadToken) {

        $.ajax({
            url: uploadToken.url,
            method: 'PUT',
            data: scope.props.file,
            cache: false,
            processData: false,
            contentType: 'binary/octet-stream',
            xhr: function () {
                var xhr = new window.XMLHttpRequest();

                //Upload progress
                xhr.upload.addEventListener("progress", function (evt) {
                    if (!scope.mounted || scope.state.status == scope.status.CANCELED) {
                        xhr.abort();
                        console.log("Cancel upload");
                    } else if (evt.lengthComputable) {
                        var percentComplete = (evt.loaded / evt.total) * 100;
                        if (scope.mounted) {
                            scope.setState({ uploadProgress: percentComplete });
                        }
                    }
                }, false);

                return xhr;
            },
            success: function (response) {
                if (scope.mounted) {
                    scope.setState({ showCancelBtn: false });
                    console.log('start POST');
                    var attachment = {
                        "fn": scope.props.file.name,
                        "key": getS3ObjectKeyFromPresignedUrl(uploadToken.url),
                        "sz": scope.props.file.size
                    };

                    $.ajax({
                        url: baseUrl + "/channels/" + selectedChannelId + "/attachments",
                        method: 'POST',
                        contentType: 'application/json',
                        processData: false,
                        data: JSON.stringify(attachment),
                        success: function (response) {
                            if (scope.mounted) {
                                scope.isDone = true;
                                scope.setState({ status: scope.status.UPLOADED, attachmentId: response.id });
                            }
                        },
                        error: function (response) {
                            if (scope.mounted) {
                                console.log(response.responseJSON);
                                scope.handleUploadError();
                                scope.setState({ status: scope.status.FAILED });
                            }
                        },
                    })
                }
            },
            error: function (response) {
                console.log(response.responseJSON);
                scope.handleUploadError();
                scope.setState({ status: scope.status.FAILED });
            }
        });

    },
    error: function (response) {
        console.log(response.responseJSON);
        scope.handleUploadError();
        scope.setState({ status: scope.status.FAILED });
    }
});

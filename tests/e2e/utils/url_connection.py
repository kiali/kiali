import urllib.request

class url_connection():

    def open_url_connection(url):
        content = None

        try:
            content = urllib.request.urlopen(url).read()
        except Exception as e:
            print ("\nURL: {} Exception{}".format(url, e))
            raise Exception(e)

        return content

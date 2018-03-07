import {intersection} from 'lodash';

SearchController.$inject = ['$location', '$filter', 'api'];
export function SearchController($location, $filter, api) {
    const SUPERDESK = 'local';
    const INTERNAL = ['archive', 'published', 'ingest', 'archived'];
    const DEFAULT_CONFIG = {
        ingest: true,
        archive: true,
        published: true,
        archived: true,
        search: SUPERDESK,
    };

    const getActiveRepos = () => INTERNAL.filter((name) => this.repo[name]);
    const resetInternalRepo = () => this.repo = Object.assign({}, DEFAULT_CONFIG);

    resetInternalRepo();

    // init based on $location
    if ($location.search().repo && !intersection($location.search().repo.split(','), INTERNAL).length) {
        this.repo.search = $location.search().repo;
    }

    // init search providers
    api.query('search_providers', {max_results: 200})
        .then((result) => {
            this.providers = $filter('sortByName')(result._items, 'search_provider');

            // init selected/default provider
            if (this.providers.length) {
                const selectedProvider = this.providers.find((provider) =>
                    provider.search_provider === $location.search().repo);
                const defaultProvider = this.providers.find((provider) => provider.is_default);

                this.activeProvider = selectedProvider || defaultProvider;
                if (this.activeProvider) {
                    this.repo.search = this.activeProvider.search_provider;
                    $location.search('repo', this.activeProvider.search_provider);
                    return;
                }
            }

            // internal search - init repos
            const repos = ($location.search().repo || '').split(',').filter((repo) => !!repo);

            INTERNAL.forEach((repo) => {
                this.repo[repo] = !repos.length || repos.indexOf(repo) >= 0;
            });
        });

    /**
     * Toggle internal repo
     * @param {string} repoName
     */
    this.toggleRepo = (repoName) => {
        this.repo[repoName] = !this.repo[repoName];
        const active = getActiveRepos();

        $location.search('repo', active.join(','));
    };

    /**
     * Toggle search provider
     * @param {Object} provider
     */
    this.toggleProvider = (provider) => {
        this.activeProvider = provider || null;
        if (provider) {
            $location.search('repo', provider.search_provider);
            this.repo = {search: provider.search_provider};
        } else {
            $location.search('repo', null);
            resetInternalRepo();
        }
    };
}
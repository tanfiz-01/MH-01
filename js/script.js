document.addEventListener('DOMContentLoaded', function () {
    async function main() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error(`Failed to load data.json: ${response.statusText}`);
            }
            const appData = await response.json();
            initializeApp(appData.species, appData.recommendations);
        } catch (error) {
            console.error("Could not initialize the application:", error);
            const explorer = document.getElementById('explorer');
            if (explorer) {
                explorer.innerHTML = `<p class="text-center text-red-600 font-semibold">Error: Could not load commodity data. Please check the data.json file and console for details.</p>`;
            }
        }
    }

    function initializeApp(speciesData, recommendationsData) {
        Chart.register(ChartDataLabels);
        
        const speciesGrid = document.getElementById('speciesGrid');
        const linkageFilterGroup = document.getElementById('linkageFilterGroup');
        const productTypeFilterGroup = document.getElementById('productTypeFilterGroup');
        const districtFilter = document.getElementById('districtFilter');
        const partsFilterContainer = document.getElementById('partsFilterContainer');
        const allPartsCheckbox = document.getElementById('all-parts-checkbox'); // NEW: "All Parts" checkbox
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        const closeModalBtn = document.getElementById('closeModal');
        const recommendationsContainer = document.getElementById('recommendationsContainer');
        const speciesCountEl = document.getElementById('speciesCount');
        let modalChart = null;

        function getLinkageIcon(linkage) {
            if (linkage === 'Backward') return { icon: '⬅️', color: 'bg-red-100 text-red-800', tooltip: 'Backward Linkage' };
            if (linkage === 'Forward') return { icon: '➡️', color: 'bg-green-100 text-green-800', tooltip: 'Forward Linkage' };
            return { icon: '⬅️➡️', color: 'bg-blue-100 text-blue-800', tooltip: 'Integrated Linkage' };
        }
        
        function renderSpecies(filteredData) {
            speciesGrid.innerHTML = '';
            document.getElementById('resultsCount').textContent = `${filteredData.length} Commodities Found`;
            const sortedData = filteredData.sort((a, b) => a.name.localeCompare(b.name));
            const template = document.getElementById('species-card-template');

            sortedData.forEach(species => {
                const card = template.content.cloneNode(true);
                const linkageInfo = getLinkageIcon(species.linkage);

                const imageEl = card.querySelector('.image');
                imageEl.src = species.image || `https://placehold.co/600x400/e2e8f0/64748b?text=${species.name.replace(/ /g, '+')}`;
                imageEl.alt = species.name;
                imageEl.onerror = () => { imageEl.src = `https://placehold.co/600x400/e2e8f0/64748b?text=${species.name.replace(/ /g, '+')}`; };

                const linkageIconEl = card.querySelector('.linkage-icon');
                linkageIconEl.title = linkageInfo.tooltip;
                linkageIconEl.textContent = linkageInfo.icon;
                linkageIconEl.classList.add(...linkageInfo.color.split(' '));

                card.querySelector('.species-name').textContent = species.name;
                card.querySelector('.botanical-name').textContent = species.botanical;
                card.querySelector('.strength').textContent = species.strength;

                const productTypeTagEl = card.querySelector('.product-type-tag');
                productTypeTagEl.textContent = species.productType;
                if (species.productType === 'Existing NTFP') {
                    productTypeTagEl.classList.add('bg-green-100', 'text-green-800');
                } else if (species.productType === 'Potential NTFP') {
                    productTypeTagEl.classList.add('bg-yellow-100', 'text-yellow-800');
                } else {
                    productTypeTagEl.classList.add('bg-purple-100', 'text-purple-800');
                }

                const linkageTagEl = card.querySelector('.linkage-tag');
                linkageTagEl.textContent = `${species.linkage} Linkage`;
                linkageTagEl.classList.add(...linkageInfo.color.split(' '));
                card.querySelector('.category-tag').textContent = species.category;

                const districtTagsContainer = card.querySelector('.district-tags');
                districtTagsContainer.innerHTML = species.districts.map(d => `<span class="inline-block bg-slate-200 text-slate-700 text-xs font-medium mr-1 px-2 py-0.5 rounded-full">${d}</span>`).join('');

                card.querySelector('.card').addEventListener('click', () => showModal(species));
                card.querySelector('.card').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') showModal(species); });
                
                speciesGrid.appendChild(card);
            });
        }    
        
        function renderRecommendationCards() {
            if (!recommendationsContainer) return;
            recommendationsContainer.innerHTML = '';
            recommendationsData.forEach((item) => {
                const card = document.createElement('div');
                card.className = 'bg-white p-6 rounded-xl shadow-lg border-[1.6px] border-slate-300 flex flex-col';
                card.innerHTML = `
                    <h4 class="text-xl font-bold text-blue-900 mb-4">${item.title}</h4>
                    <div class="text-slate-600 space-y-2">${item.content}</div>
                `;
                recommendationsContainer.appendChild(card);
            });
        }

        function populateFilters() {
            const districts = [...new Set(speciesData.flatMap(s => s.districts))].sort();
            districtFilter.innerHTML = '<option value="all">All Districts</option>';
            districts.forEach(d => {
                const option = document.createElement('option');
                option.value = d;
                option.textContent = d;
                districtFilter.appendChild(option);
            });

            const parts = [...new Set(speciesData.flatMap(s => s.partsUsed))].sort();
            
            // UPDATED: Create a grid container for the checkboxes
            const partsGridContainer = document.createElement('div');
            partsGridContainer.className = 'parts-grid'; // This new class will be styled in CSS

            parts.forEach(part => {
                const wrapper = document.createElement('div');
                wrapper.className = 'flex items-center';
        
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `part-${part.replace(/\s+/g, '-')}`;
                checkbox.value = part;
                checkbox.className = 'part-checkbox h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer';
        
                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = part;
                // UPDATED: Font size changed from text-sm to text-xs
                label.className = 'ml-2 text-xs font-medium text-gray-700 cursor-pointer'; 
                
                wrapper.appendChild(checkbox);
                wrapper.appendChild(label);
                partsGridContainer.appendChild(wrapper); // Append to the new grid container
            });
            
            // Append the grid container to the main filter container
            partsFilterContainer.appendChild(partsGridContainer);
        }

        function showModal(species) {
            modalTitle.textContent = species.name;
            let productsHtml = species.products.map(p => `<li class="text-slate-600">${p}</li>`).join('');
            let partsUsedHtml = species.partsUsed.map(p => `<span class="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full">${p}</span>`).join('');

            modalBody.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-start">
                    <div>
                        <p class="text-sm text-slate-500 italic mb-4">${species.botanical}</p>
                        <h5 class="font-bold text-slate-800 mb-2">Core Strength & Market Driver</h5>
                        <p class="text-slate-600 mb-4">${species.strength}</p>
                        <h5 class="font-bold text-slate-800 mb-2">Primary Parts Used</h5>
                        <div class="flex flex-wrap gap-2 mb-4">${partsUsedHtml}</div>
                        <h5 class="font-bold text-slate-800 mb-2">Key Value-Added Products</h5>
                        <ul class="list-disc list-inside space-y-1 mb-4">${productsHtml}</ul>
                        <h5 class="font-bold text-slate-800 mb-2">Strategic Intervention Priority: <span class="text-blue-700">${species.linkage}</span></h5>
                        <p class="text-slate-600">${species.justification}</p>
                    </div>
                    <div class="flex items-center justify-center min-h-[175px] bg-slate-50 rounded-lg overflow-hidden">
                        ${species.chartData 
                            ? `<div class="chart-container relative h-64 md:h-80 w-full max-w-md mx-auto"><canvas id="modalChartCanvas"></canvas></div>` 
                            : `<img src="${species.image}" alt="Image of ${species.name}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/e2e8f0/64748b?text=${encodeURIComponent(species.name)}';">`
                        }
                    </div>
                </div>`;
            document.body.classList.add('modal-open');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            setTimeout(() => { modal.querySelector('.modal-content').classList.remove('scale-95'); modal.classList.remove('opacity-0'); }, 10);
            if (species.chartData) {
                const ctx = document.getElementById('modalChartCanvas').getContext('2d');
                if (modalChart) modalChart.destroy();
                modalChart = new Chart(ctx, { type: species.chartData.type, data: { labels: species.chartData.labels, datasets: [{ label: 'Value', data: species.chartData.values, backgroundColor: ['rgba(59, 130, 246, 0.5)', 'rgba(239, 68, 68, 0.5)', 'rgba(245, 158, 11, 0.5)'], borderColor: ['rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)'], borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: species.chartData.type === 'pie' }, title: { display: true, text: species.chartData.title, font: { size: 14 } } }, scales: { y: { beginAtZero: true, display: species.chartData.type !== 'pie' } } } });
            }
        }

        function hideModal() {
            document.body.classList.remove('modal-open');
            modal.querySelector('.modal-content').classList.add('scale-95');
            modal.classList.add('opacity-0');
            setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); if (modalChart) { modalChart.destroy(); modalChart = null; } }, 300);
        }

        function applyFilters() {
            const productType = productTypeFilterGroup.querySelector('.active-filter').dataset.value;
            const link = linkageFilterGroup.querySelector('.active-filter').dataset.value;
            const district = districtFilter.value;
            
            const selectedPartNodes = partsFilterContainer.querySelectorAll('.part-checkbox:checked');
            const selectedParts = Array.from(selectedPartNodes).map(node => node.value);

            const filtered = speciesData.filter(s => {
                const productTypeMatch = productType === 'all' || s.productType === productType;
                const linkageMatch = link === 'all' || s.linkage === link;
                const districtMatch = district === 'all' || s.districts.includes(district);
                const partMatch = selectedParts.length === 0 || allPartsCheckbox.checked || s.partsUsed.some(part => selectedParts.includes(part));
                
                return productTypeMatch && linkageMatch && districtMatch && partMatch;
            });
            renderSpecies(filtered);
        }

        function handlePartsCheckboxes(e) {
            const individualCheckboxes = partsFilterContainer.querySelectorAll('.part-checkbox');
            
            // If the "All Parts" checkbox was the one that changed
            if (e.target.id === 'all-parts-checkbox') {
                individualCheckboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            } else { // If an individual checkbox changed
                const allChecked = Array.from(individualCheckboxes).every(checkbox => checkbox.checked);
                allPartsCheckbox.checked = allChecked;
            }
            applyFilters();
        }

        function updateSummaryMetrics() {
            speciesCountEl.textContent = speciesData.length;
        }
        
        function renderDashboardCharts() {
            const linkageCounts = speciesData.reduce((acc, curr) => { acc[curr.linkage] = (acc[curr.linkage] || 0) + 1; return acc; }, {});
            const sortedLinkageLabels = Object.keys(linkageCounts).sort();
            const sortedLinkageValues = sortedLinkageLabels.map(label => linkageCounts[label]);
            new Chart(document.getElementById('linkageChart').getContext('2d'), { type: 'doughnut', data: { labels: sortedLinkageLabels, datasets: [{ data: sortedLinkageValues, backgroundColor: ['rgba(239, 68, 68, 0.7)', 'rgba(34, 197, 94, 0.7)', 'rgba(59, 130, 246, 0.7)'], borderColor: ['#fff'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, datalabels: { formatter: (v) => v, color: '#fff', font: { weight: 'bold', size: 16 } } } } });

            const categoryCounts = speciesData.reduce((acc, curr) => { acc[curr.category] = (acc[curr.category] || 0) + 1; return acc; }, {});
            const sortedCategories = Object.entries(categoryCounts).sort(([,a],[,b]) => b - a);
            new Chart(document.getElementById('categoryBarChart').getContext('2d'), {
                type: 'bar',
                data: { labels: sortedCategories.map(item => item[0]), datasets: [{ label: 'Number of Commodities', data: sortedCategories.map(item => item[1]), backgroundColor: 'rgba(59, 130, 246, 0.7)' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'end', color: '#1e3a8a', font: { weight: 'bold' } } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });

            const districtCounts = speciesData.reduce((acc, species) => {
                species.districts.forEach(district => { acc[district] = (acc[district] || 0) + 1; });
                return acc;
            }, {});
            const treemapData = Object.entries(districtCounts).map(([key, value]) => ({ district: key, count: value }));
            const colors = ['#2962ff', '#e65100', '#2e7d32', '#d50000', '#4527a0', '#006064', '#c51162', '#00b8d4', '#f9a825', '#5d4037', '#424242'];
            
            new Chart(document.getElementById('districtTreemapChart').getContext('2d'), {
                type: 'treemap',
                data: {
                    datasets: [{
                        label: 'District Opportunities',
                        tree: treemapData,
                        key: 'count',
                        groups: ['district'],
                        backgroundColor: (ctx) => {
                            if (ctx.type !== 'data') return 'transparent';
                            const index = ctx.dataIndex % colors.length;
                            return colors[index];
                        },
                        labels: {
                            display: true,
                            font: { size: 14, weight: 'bold' },
                            color: 'white',
                            formatter: (ctx) => `${ctx.raw._data.district}\n(${ctx.raw.v})`
                        }
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
        }
        
        productTypeFilterGroup.addEventListener('click', (e) => {
            const clickedButton = e.target.closest('button');
            if (!clickedButton) return;
            productTypeFilterGroup.querySelectorAll('button').forEach(button => { button.classList.remove('active-filter'); button.classList.add('inactive-filter'); });
            clickedButton.classList.add('active-filter');
            clickedButton.classList.remove('inactive-filter');
            applyFilters();
        });

        linkageFilterGroup.addEventListener('click', (e) => {
            const clickedButton = e.target.closest('button');
            if (!clickedButton) return;
            linkageFilterGroup.querySelectorAll('button').forEach(button => { button.classList.remove('active-filter'); button.classList.add('inactive-filter'); });
            clickedButton.classList.add('active-filter');
            clickedButton.classList.remove('inactive-filter');
            applyFilters();
        });

        districtFilter.addEventListener('change', applyFilters);
        partsFilterContainer.addEventListener('change', handlePartsCheckboxes);

        closeModalBtn.addEventListener('click', hideModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) hideModal(); });
        
        updateSummaryMetrics();
        populateFilters();
        renderSpecies(speciesData);
        renderRecommendationCards();
        renderDashboardCharts();
        allPartsCheckbox.checked = true; // Start with "All Parts" checked
    }

    main();
});
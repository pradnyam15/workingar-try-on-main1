// Handle Rings dropdown toggle
document.addEventListener('DOMContentLoaded', () => {
  const ringsDropdown = document.querySelector('.dropdown');
  const ringsButton = document.getElementById('ringsDropdown');
  const ringOptions = document.querySelectorAll('.ring-option');
  
  // Make sure the dropdown is visible
  ringsButton.style.display = 'flex';
  ringsButton.style.alignItems = 'center';
  ringsButton.style.justifyContent = 'space-between';
  ringsButton.style.width = '100%';
  
  // Toggle dropdown
  ringsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = ringsButton.getAttribute('aria-expanded') === 'true';
    ringsButton.setAttribute('aria-expanded', !isExpanded);
    
    // Close other dropdowns
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      if (dropdown !== ringsDropdown) {
        dropdown.querySelector('button').setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Handle ring selection
  ringOptions.forEach(option => {
    // Make sure option is visible and clickable
    option.style.display = 'flex';
    option.style.flexDirection = 'column';
    option.style.alignItems = 'center';
    option.style.cursor = 'pointer';
    
    option.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = option.dataset.color;
      const name = option.querySelector('.ring-option-name').textContent;
      const image = option.querySelector('.ring-option-image').src;
      
      // Update the active state
      ringOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      
      // Update the button text
      ringsButton.innerHTML = `
        <i class="fas fa-ring"></i>
        <span>${name}</span>
        <i class="fas fa-chevron-down"></i>
      `;
      
      // Close the dropdown
      ringsButton.setAttribute('aria-expanded', 'false');
      
      // Trigger the ring selection (assuming you have a function to handle this)
      if (window.selectRing) {
        window.selectRing(color, name, image);
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    ringsButton.setAttribute('aria-expanded', 'false');
  });

  // Prevent dropdown from closing when clicking inside
  const dropdownMenu = document.querySelector('.dropdown-menu');
  if (dropdownMenu) {
    dropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  
  // Initialize first ring as active
  if (ringOptions.length > 0) {
    ringOptions[0].classList.add('active');
  }
});

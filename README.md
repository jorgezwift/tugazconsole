## TugaZ Console

**$$ Zwift Client must be running in local machine**  
**$$ Logged in rider must be participating on the TTT of "Fan viewing" a team rider**  
**$$ npcap needed (https://nmap.org/npcap/)**  

## Configuration Files
Sample config file located at conf.json  
Sample html file located at index.html  

**port**: HTML server Port;  
**user**: Zwift User;  
**pwd**: Zwift Password;  
**user_is_rider**: **true** if user logged in Zwift Client is also a rider in the TTT. **false** if Zwift is in Fan View;  
**user_zid**: Logged in rider Zwift ID;  
**map**: Name of TTT map file (without extension). All maps located at maps/ folder;  
**start_time**: TTT start time (HHMMSS);  
**team_leader**: TugaZ team leader Zwift ID;  
**turn_timer_active**: Turns timer active;  
**turns_sequence_names**: Rider turns sequence list;  
**riders**: list of TugaZ team riders;  
**other_teams**: Teams to follow during the TTT;  

## Configuration Tool
Enter in http://_url_:_port_/tools/build_template_conf.html to do an automatic Team configuration with data fetched from WTRL and ZwiftPower websites.

## Usage
### From source
> node bin.js _config_file_ _html_file_  

Maps & distances at maps/  

### From binaries
Win64 binaries located at dist/  
> run.bat  

